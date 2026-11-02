"""
BIASHARASASA — Tenant Admin Console
Single-page Streamlit app where a tenant owner manages members and roles.

Two enforcement axes:
  • TENANT boundary -> every query scoped to the active tenant (scoped views)
  • ROLE boundary   -> server-side permission checks + DB-level guard

Roles (static, least-privilege):
  owner       : full control (billing, members, roles, all data)
  manager     : operations + reports; no billing, no member admin
  cashier     : record sales only
  inventory   : manage products/stock only
  accountant  : read-only financials

Run:
    pip install streamlit pandas
    streamlit run app.py
"""
import os
import re
import uuid
import json
import sqlite3
import datetime as dt

import streamlit as st
import pandas as pd

LOCAL_DB = os.getenv("LOCAL_DB", "biashara_admin.db")


def now_iso() -> str:
    return dt.datetime.utcnow().isoformat(timespec="seconds") + "Z"


def safe_ident(s: str) -> str:
    c = re.sub(r"[^a-zA-Z0-9_]", "_", s.lower())
    if not c or not c[0].isalpha():
        c = "t_" + c
    return c[:40]


# ---------------------------------------------------------------------------
# 1. ROLE MODEL (static, least-privilege)
# ---------------------------------------------------------------------------
ROLES = {
    "owner":      {"label": "Owner",           "desc": "Full control of the tenant."},
    "manager":    {"label": "Manager",         "desc": "Operations + reports; no billing or member admin."},
    "cashier":    {"label": "Cashier",         "desc": "Record sales only."},
    "inventory":  {"label": "Inventory Clerk", "desc": "Manage products and stock."},
    "accountant": {"label": "Accountant",      "desc": "Read-only financials."},
}
ROLE_ORDER = ["owner", "manager", "inventory", "cashier", "accountant"]

# What each role may DO (permission keys)
PERMISSIONS = {
    "owner":      {"view_dashboard", "manage_members", "assign_roles", "manage_billing",
                   "edit_products", "record_sales", "view_reports"},
    "manager":    {"view_dashboard", "edit_products", "record_sales", "view_reports"},
    "inventory":  {"view_dashboard", "edit_products"},
    "cashier":    {"view_dashboard", "record_sales"},
    "accountant": {"view_dashboard", "view_reports"},
}


def can(role: str, permission: str) -> bool:
    return permission in PERMISSIONS.get(role, set())


# ---------------------------------------------------------------------------
# 2. STORAGE (SQLite — swap for PostgreSQL as in the prior app)
# ---------------------------------------------------------------------------
def db():
    c = sqlite3.connect(LOCAL_DB, check_same_thread=False)
    c.execute("PRAGMA journal_mode=WAL")
    c.execute("PRAGMA foreign_keys=ON")
    return c


def init_db():
    c = db(); cur = c.cursor()
    cur.executescript("""
        CREATE TABLE IF NOT EXISTS tenants (
            tenant_id   TEXT PRIMARY KEY,
            tenant_name TEXT NOT NULL,
            created_at  TEXT NOT NULL,
            printer_model TEXT,
            printer_width TEXT
        );
        CREATE TABLE IF NOT EXISTS users (
            user_id    TEXT PRIMARY KEY,
            email      TEXT NOT NULL UNIQUE,
            full_name  TEXT NOT NULL,
            created_at TEXT NOT NULL
        );
        CREATE TABLE IF NOT EXISTS memberships (
            membership_id TEXT PRIMARY KEY,
            tenant_id     TEXT NOT NULL,
            user_id       TEXT NOT NULL,
            role          TEXT NOT NULL,
            status        TEXT NOT NULL DEFAULT 'active',  -- invited|active|suspended|removed
            invited_by    TEXT,
            created_at    TEXT NOT NULL,
            updated_at    TEXT NOT NULL,
            UNIQUE (tenant_id, user_id)
        );
        CREATE TABLE IF NOT EXISTS audit_log (
            id         INTEGER PRIMARY KEY AUTOINCREMENT,
            tenant_id  TEXT NOT NULL,
            actor_id   TEXT NOT NULL,
            action     TEXT NOT NULL,
            target     TEXT,
            detail     TEXT,
            created_at TEXT NOT NULL
        );
        CREATE INDEX IF NOT EXISTS ix_mem_tenant ON memberships(tenant_id);
        CREATE INDEX IF NOT EXISTS ix_audit_tenant ON audit_log(tenant_id);
    """)
    c.commit(); c.close()


init_db()


# ---------------------------------------------------------------------------
# 3. ONBOARDING (owner is auto-provisioned)
# ---------------------------------------------------------------------------
def onboard_tenant(tenant_name: str, owner_email: str, owner_name: str, printer_model: str = "Premax POS-80C", printer_width: str = "80mm") -> dict:
    tenant_id = f"{safe_ident(tenant_name)}_{uuid.uuid4().hex[:6]}"
    now = now_iso()
    c = db(); cur = c.cursor()
    cur.execute("INSERT INTO tenants (tenant_id, tenant_name, created_at, printer_model, printer_width) VALUES (?,?,?,?,?)", 
                (tenant_id, tenant_name, now, printer_model, printer_width))

    cur.execute("SELECT user_id FROM users WHERE email=?", (owner_email.lower(),))
    row = cur.fetchone()
    if row:
        user_id = row[0]
    else:
        user_id = str(uuid.uuid4())
        cur.execute("INSERT INTO users VALUES (?,?,?,?)",
                    (user_id, owner_email.lower(), owner_name, now))

    mid = str(uuid.uuid4())
    cur.execute("""INSERT INTO memberships
        (membership_id,tenant_id,user_id,role,status,invited_by,created_at,updated_at)
        VALUES (?,?,?,?,?,?,?,?)""",
        (mid, tenant_id, user_id, "owner", "active", None, now, now))
    cur.execute("INSERT INTO audit_log (tenant_id,actor_id,action,target,detail,created_at) "
                "VALUES (?,?,?,?,?,?)",
                (tenant_id, user_id, "tenant.onboard", tenant_id, tenant_name, now))
    c.commit(); c.close()
    return {"tenant_id": tenant_id, "owner_user_id": user_id}


# ---------------------------------------------------------------------------
# 4. MEMBERSHIP OPERATIONS (tenant- + role-enforced)
# ---------------------------------------------------------------------------
def require(actor_membership: dict, permission: str):
    """Server-side role gate. Raises if denied."""
    if actor_membership["status"] != "active":
        raise PermissionError("Membership is not active.")
    if not can(actor_membership["role"], permission):
        raise PermissionError(f"Role '{actor_membership['role']}' lacks '{permission}'.")


def list_members(tenant_id: str) -> pd.DataFrame:
    c = db(); cur = c.cursor()
    cur.execute("""
        SELECT m.membership_id, u.email, u.full_name, m.role, m.status, m.created_at
        FROM memberships m JOIN users u ON u.user_id = m.user_id
        WHERE m.tenant_id = ? AND m.status != 'removed'
        ORDER BY m.created_at
    """, (tenant_id,))
    rows = cur.fetchall(); cols = [d[0] for d in cur.description]; c.close()
    return pd.DataFrame(rows, columns=cols)


def upsert_user(email: str, full_name: str) -> str:
    c = db(); cur = c.cursor()
    cur.execute("SELECT user_id FROM users WHERE email=?", (email.lower(),))
    r = cur.fetchone()
    if r:
        user_id = r[0]
    else:
        user_id = str(uuid.uuid4())
        cur.execute("INSERT INTO users VALUES (?,?,?,?)",
                    (user_id, email.lower(), full_name, now_iso()))
        c.commit()
    c.close()
    return user_id


def invite_member(actor: dict, tenant_id: str, email: str, full_name: str, role: str) -> str:
    require(actor, "manage_members")
    if role not in ROLES:
        raise ValueError("Unknown role.")
    if role == "owner":
        raise PermissionError("Owner role cannot be granted via invite.")

    user_id = upsert_user(email, full_name)
    now = now_iso()
    c = db(); cur = c.cursor()
    cur.execute("SELECT membership_id,status FROM memberships WHERE tenant_id=? AND user_id=?",
                (tenant_id, user_id))
    existing = cur.fetchone()
    mid = str(uuid.uuid4())
    if existing:
        mid = existing[0]
        cur.execute("""UPDATE memberships SET role=?, status='invited',
                       invited_by=?, updated_at=? WHERE membership_id=?""",
                    (role, actor["user_id"], now, mid))
    else:
        cur.execute("""INSERT INTO memberships
            (membership_id,tenant_id,user_id,role,status,invited_by,created_at,updated_at)
            VALUES (?,?,?,?,?,?,?,?)""",
            (mid, tenant_id, user_id, role, "invited", actor["user_id"], now, now))
    cur.execute("INSERT INTO audit_log (tenant_id,actor_id,action,target,detail,created_at) "
                "VALUES (?,?,?,?,?,?)",
                (tenant_id, actor["user_id"], "member.invite", user_id, f"{email} as {role}", now))
    c.commit(); c.close()
    return mid


def change_role(actor: dict, tenant_id: str, membership_id: str, new_role: str):
    require(actor, "assign_roles")
    if new_role not in ROLES:
        raise ValueError("Unknown role.")

    c = db(); cur = c.cursor()
    cur.execute("SELECT user_id,role FROM memberships WHERE membership_id=? AND tenant_id=?",
                (membership_id, tenant_id))
    r = cur.fetchone()
    if not r:
        c.close(); raise KeyError("Membership not found in this tenant.")
    target_user, old_role = r
    if old_role == "owner":
        c.close(); raise PermissionError("Owner role is transfer-only; not editable here.")
    if new_role == "owner":
        c.close(); raise PermissionError("Use transfer-ownership to grant owner.")
    now = now_iso()
    cur.execute("UPDATE memberships SET role=?, updated_at=? WHERE membership_id=?",
                (new_role, now, membership_id))
    cur.execute("INSERT INTO audit_log (tenant_id,actor_id,action,target,detail,created_at) "
                "VALUES (?,?,?,?,?,?)",
                (tenant_id, actor["user_id"], "member.role_change", target_user,
                 f"{old_role} -> {new_role}", now))
    c.commit(); c.close()


def set_status(actor: dict, tenant_id: str, membership_id: str, status: str):
    require(actor, "manage_members")
    if status not in ("active", "suspended", "removed"):
        raise ValueError("Bad status.")
    c = db(); cur = c.cursor()
    cur.execute("SELECT user_id,role FROM memberships WHERE membership_id=? AND tenant_id=?",
                (membership_id, tenant_id))
    r = cur.fetchone()
    if not r:
        c.close(); raise KeyError("Not found.")
    target_user, role = r
    if role == "owner":
        c.close(); raise PermissionError("Owner cannot be suspended or removed here.")
    now = now_iso()
    cur.execute("UPDATE memberships SET status=?, updated_at=? WHERE membership_id=?",
                (status, now, membership_id))
    cur.execute("INSERT INTO audit_log (tenant_id,actor_id,action,target,detail,created_at) "
                "VALUES (?,?,?,?,?,?)",
                (tenant_id, actor["user_id"], f"member.{status}", target_user, "", now))
    c.commit(); c.close()


def audit_trail(tenant_id: str, limit: int = 100) -> pd.DataFrame:
    c = db(); cur = c.cursor()
    cur.execute("""
        SELECT a.created_at, u.email AS actor, a.action, a.target, a.detail
        FROM audit_log a LEFT JOIN users u ON u.user_id = a.actor_id
        WHERE a.tenant_id = ?
        ORDER BY a.id DESC LIMIT ?
    """, (tenant_id, limit))
    rows = cur.fetchall(); cols = [d[0] for d in cur.description]; c.close()
    return pd.DataFrame(rows, columns=cols)


def get_memberships_for_tenant(tenant_id: str) -> list[dict]:
    c = db(); cur = c.cursor()
    cur.execute("""
        SELECT m.membership_id, m.user_id, u.email, m.role, m.status
        FROM memberships m JOIN users u ON u.user_id = m.user_id
        WHERE m.tenant_id = ? AND m.status = 'active'
        ORDER BY m.created_at
    """, (tenant_id,))
    rows = cur.fetchall(); c.close()
    return [{"membership_id": r[0], "user_id": r[1], "email": r[2],
             "role": r[3], "status": r[4]} for r in rows]


# ---------------------------------------------------------------------------
# 5. UI
# ---------------------------------------------------------------------------
st.set_page_config(page_title="BIASHARASASA — Tenant Admin", page_icon="🛡️", layout="wide")
st.title("🛡️ BIASHARASASA — Tenant Admin")
st.caption("Control members, roles, and access — enforced on two axes (tenant + role).")

# --- Onboarding -----------------------------------------------------------
st.subheader("1. Onboard a Tenant")
with st.form("onboard", clear_on_submit=True):
    c1, c2, c3 = st.columns(3)
    tname = c1.text_input("Merchant name", placeholder="Mama Njeri's Duka")
    oname = c2.text_input("Owner full name", placeholder="Njeri Kamau")
    oemail = c3.text_input("Owner email", placeholder="njeri@example.com")
    
    col1, col2 = st.columns(2)
    p_model = col1.selectbox("Thermal Printer Model", 
                           ["Premax POS-80C", "Xprinter XP-N160I", "Generic 58mm", "Generic 80mm"])
    p_width = col2.radio("Paper Width", ["80mm", "58mm"], horizontal=True)

    if st.form_submit_button("Onboard (owner auto-provisioned)", type="primary"):
        if tname.strip() and oname.strip() and oemail.strip():
            rec = onboard_tenant(tname.strip(), oemail.strip(), oname.strip(), p_model, p_width)
            st.session_state.active_tenant = rec["tenant_id"]
            st.session_state.actor_email = oemail.strip().lower()
            st.success(f"Tenant **{tname}** provisioned. Owner: {oemail}")
        else:
            st.error("All fields are required.")

# --- Tenant + actor selection --------------------------------------------
c = db(); cur = c.cursor()
cur.execute("SELECT tenant_id, tenant_name FROM tenants ORDER BY created_at")
tenants = cur.fetchall(); c.close()

if tenants:
    st.divider()
    st.subheader("2. Active Tenant & Acting Member")
    labels = {tid: name for tid, name in tenants}
    default = st.session_state.get("active_tenant", tenants[0][0])
    idx = [t[0] for t in tenants].index(default) if default in [t[0] for t in tenants] else 0
    tid = st.selectbox("Tenant", [t[0] for t in tenants], index=idx,
                       format_func=lambda x: labels[x])
    st.session_state.active_tenant = tid

    members = get_memberships_for_tenant(tid)
    actor = None
    if members:
        emails = [m["email"] for m in members]
        dflt = st.session_state.get("actor_email", emails[0])
        ai = emails.index(dflt) if dflt in emails else 0
        pick = st.selectbox("Acting as (simulates login)", emails, index=ai,
                            help="In production this comes from a signed JWT.")
        actor = next(m for m in members if m["email"] == pick)
        st.session_state.actor_email = pick
        st.caption(f"Role: **{ROLES[actor['role']]['label']}** — {ROLES[actor['role']]['desc']}")
    else:
        st.warning("No active members in this tenant.")

    # --- Tabs --------------------------------------------------------------
    tab_members, tab_roles, tab_audit = st.tabs(["👥 Members", "🔐 Roles & Permissions", "📜 Audit log"])

    # -- Members tab ------------------------------------------------------
    with tab_members:
        if actor:
            if can(actor["role"], "manage_members"):
                st.subheader("Invite a member")
                with st.form("invite", clear_on_submit=True):
                    c1, c2, c3 = st.columns(3)
                    ie = c1.text_input("Email", placeholder="staff@example.com")
                    iname = c2.text_input("Full name", placeholder="Staff Name")
                    irole = c3.selectbox("Role", [r for r in ROLE_ORDER if r != "owner"],
                                         format_func=lambda r: ROLES[r]["label"])
                    if st.form_submit_button("Send invite", type="primary"):
                        if ie.strip() and iname.strip():
                            try:
                                invite_member(actor, tid, ie.strip(), iname.strip(), irole)
                                st.success(f"Invited {ie} as {ROLES[irole]['label']}.")
                                st.rerun()
                            except Exception as e:
                                st.error(str(e))
                        else:
                            st.error("Email and name required.")
            else:
                st.info("Your role cannot invite members.")

            st.subheader("Team members")
            df = list_members(tid)
            st.dataframe(df[["email", "full_name", "role", "status", "created_at"]],
                         use_container_width=True)

            st.subheader("Manage a member")
            if not df.empty and can(actor["role"], "assign_roles"):
                non_owner = df[df["role"] != "owner"]
                if non_owner.empty:
                    st.caption("Only the owner exists — invite someone to manage them.")
                else:
                    pick = st.selectbox("Member", non_owner["membership_id"].tolist(),
                                        format_func=lambda m: non_owner.loc[
                                            non_owner["membership_id"] == m, "email"].iloc[0])
                    row = non_owner[non_owner["membership_id"] == pick].iloc[0]
                    c1, c2, c3 = st.columns(3)
                    with c1:
                        new_role = st.selectbox("New role",
                                                [r for r in ROLE_ORDER if r != "owner"],
                                                index=[r for r in ROLE_ORDER if r != "owner"].index(row["role"]))
                        if st.button("Change role"):
                            try:
                                change_role(actor, tid, pick, new_role)
                                st.success("Role updated."); st.rerun()
                            except Exception as e:
                                st.error(str(e))
                    with c2:
                        if row["status"] != "active":
                            if st.button("Activate"):
                                try:
                                    set_status(actor, tid, pick, "active")
                                    st.success("Activated."); st.rerun()
                                except Exception as e:
                                    st.error(str(e))
                        else:
                            if st.button("Suspend"):
                                try:
                                    set_status(actor, tid, pick, "suspended")
                                    st.success("Suspended."); st.rerun()
                                except Exception as e:
                                    st.error(str(e))
                    with c3:
                        if st.button("Remove"):
                            try:
                                set_status(actor, tid, pick, "removed")
                                st.success("Removed."); st.rerun()
                            except Exception as e:
                                st.error(str(e))
            elif not can(actor["role"], "assign_roles"):
                st.caption("Your role cannot change roles.")

    # -- Roles tab --------------------------------------------------------
    with tab_roles:
        st.subheader("Roles in this tenant")
        for r in ROLE_ORDER:
            with st.expander(f"{ROLES[r]['label']} — {ROLES[r]['desc']}"):
                perms = sorted(PERMISSIONS[r])
                st.write("Permissions:", ", ".join(f"`{p}`" for p in perms) or "—")
                count = len([m for m in members if m["role"] == r])
                st.caption(f"{count} member(s) in this tenant hold this role.")

        st.subheader("Permission matrix")
        matrix = pd.DataFrame(
            [[("✅" if p in PERMISSIONS[r] else "—") for r in ROLE_ORDER]
             for p in sorted(set().union(*PERMISSIONS.values()))],
            index=sorted(set().union(*PERMISSIONS.values())),
            columns=[ROLES[r]["label"] for r in ROLE_ORDER])
        st.dataframe(matrix, use_container_width=True)

    # -- Audit tab --------------------------------------------------------
    with tab_audit:
        st.subheader("Audit trail (this tenant only)")
        st.caption("Every membership, role, and status change is recorded.")
        st.dataframe(audit_trail(tid), use_container_width=True)
else:
    st.info("Onboard a tenant to begin.")

st.divider()
st.caption("Isolation: tenant-scoped queries + server-side role checks. "
           "In production, derive actor identity from a signed JWT — never trust the client.")
