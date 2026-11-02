import os
import sqlite3
from flask import Flask, request, jsonify, render_template_string

app = Flask(__name__)
DB_FILE = "biasharasasa.db"

def init_db():
    conn = sqlite3.connect(DB_FILE)
    cursor = conn.cursor()
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS products (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            price REAL NOT NULL,
            stock INTEGER NOT NULL
        )
    """)
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS orders (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            customer_name TEXT NOT NULL,
            product_name TEXT NOT NULL,
            quantity INTEGER NOT NULL,
            total_price REAL NOT NULL
        )
    """)
    conn.commit()
    conn.close()

init_db()

HTML_TEMPLATE = """
<!DOCTYPE html>
<html>
<head>
    <title>BiasharaSasa Management Dashboard</title>
    <link href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.0/dist/css/bootstrap.min.css" rel="stylesheet">
    <style>
        body { background-color: #f8f9fa; padding: 20px; }
        .card { margin-bottom: 20px; border-radius: 12px; border: none; box-shadow: 0 4px 12px rgba(0,0,0,0.1); }
        .btn-primary { background-color: #6366f1; border: none; }
    </style>
</head>
<body>
    <div class="container">
        <h1 class="mb-4">📊 BiasharaSasa Management Dashboard</h1>
        <p class="text-muted">Production-ready Flask web server running on Railway.</p>

        <div class="row">
            <div class="col-md-6">
                <div class="card p-4">
                    <h3>Add New Product</h3>
                    <form method="POST" action="/add_product">
                        <div class="mb-3">
                            <label class="form-label">Product Name</label>
                            <input type="text" name="name" class="form-control" required>
                        </div>
                        <div class="mb-3">
                            <label class="form-label">Price (KES/BIF)</label>
                            <input type="number" name="price" class="form-control" step="0.01" required>
                        </div>
                        <div class="mb-3">
                            <label class="form-label">Stock Quantity</label>
                            <input type="number" name="stock" class="form-control" required>
                        </div>
                        <button type="submit" class="btn btn-primary w-100">Add Product</button>
                    </form>
                </div>
            </div>
            <div class="col-md-6">
                <div class="card p-4">
                    <h3>Record New Order</h3>
                    <form method="POST" action="/record_order">
                        <div class="mb-3">
                            <label class="form-label">Customer Name</label>
                            <input type="text" name="customer_name" class="form-control" required>
                        </div>
                        <div class="mb-3">
                            <label class="form-label">Select Product</label>
                            <select name="product_name" class="form-select">
                                {% for product in products %}
                                <option value="{{ product.name }}">{{ product.name }} (Stock: {{ product.stock }})</option>
                                {% endfor %}
                            </select>
                        </div>
                        <div class="mb-3">
                            <label class="form-label">Quantity</label>
                            <input type="number" name="quantity" class="form-control" required>
                        </div>
                        <button type="submit" class="btn btn-success w-100">Record Order</button>
                    </form>
                </div>
            </div>
        </div>

        <div class="card p-4">
            <h3>Inventory Status</h3>
            <table class="table table-hover">
                <thead>
                    <tr>
                        <th>ID</th>
                        <th>Product Name</th>
                        <th>Price</th>
                        <th>Stock</th>
                    </tr>
                </thead>
                <tbody>
                    {% for product in products %}
                    <tr>
                        <td>{{ product.id }}</td>
                        <td>{{ product.name }}</td>
                        <td>{{ product.price }}</td>
                        <td>{{ product.stock }}</td>
                    </tr>
                    {% endfor %}
                </tbody>
            </table>
        </div>

        <div class="card p-4">
            <h3>Recent Orders</h3>
            <table class="table table-hover">
                <thead>
                    <tr>
                        <th>ID</th>
                        <th>Customer</th>
                        <th>Product</th>
                        <th>Qty</th>
                        <th>Total</th>
                    </tr>
                </thead>
                <tbody>
                    {% for order in orders %}
                    <tr>
                        <td>{{ order.id }}</td>
                        <td>{{ order.customer_name }}</td>
                        <td>{{ order.product_name }}</td>
                        <td>{{ order.quantity }}</td>
                        <td>{{ order.total_price }}</td>
                    </tr>
                    {% endfor %}
                </tbody>
            </table>
        </div>
    </div>
</body>
</html>
"""

@app.route("/")
def index():
    conn = sqlite3.connect(DB_FILE)
    conn.row_factory = sqlite3.Row
    cursor = conn.cursor()
    products = cursor.execute("SELECT * FROM products").fetchall()
    orders = cursor.execute("SELECT * FROM orders ORDER BY id DESC").fetchall()
    conn.close()
    return render_template_string(HTML_TEMPLATE, products=products, orders=orders)

@app.route("/add_product", methods=["POST"])
def add_product():
    name = request.form.get("name")
    price = float(request.form.get("price", 0))
    stock = int(request.form.get("stock", 0))
    
    conn = sqlite3.connect(DB_FILE)
    cursor = conn.cursor()
    cursor.execute("INSERT INTO products (name, price, stock) VALUES (?, ?, ?)", (name, price, stock))
    conn.commit()
    conn.close()
    return render_template_string('<script>alert("Product Added"); window.location="/";</script>')

@app.route("/record_order", methods=["POST"])
def record_order():
    cust_name = request.form.get("customer_name")
    prod_name = request.form.get("product_name")
    qty = int(request.form.get("quantity", 0))
    
    conn = sqlite3.connect(DB_FILE)
    conn.row_factory = sqlite3.Row
    cursor = conn.cursor()
    
    prod = cursor.execute("SELECT * FROM products WHERE name = ?", (prod_name,)).fetchone()
    if prod and prod['stock'] >= qty:
        total = prod['price'] * qty
        new_stock = prod['stock'] - qty
        cursor.execute("UPDATE products SET stock = ? WHERE name = ?", (new_stock, prod_name))
        cursor.execute("INSERT INTO orders (customer_name, product_name, quantity, total_price) VALUES (?, ?, ?, ?)",
                       (cust_name, prod_name, qty, total))
        conn.commit()
        msg = f"Order recorded for {cust_name}!"
    else:
        msg = "Insufficient stock!"
    
    conn.close()
    return render_template_string(f'<script>alert("{msg}"); window.location="/";</script>')

if __name__ == "__main__":
    port = int(os.environ.get("PORT", 5000))
    app.run(host="0.0.0.0", port=port)
