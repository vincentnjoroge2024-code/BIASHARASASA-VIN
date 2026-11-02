import React, { useState, useEffect, useMemo } from 'react';
import { useAppContext } from '../../context';
import * as api from '../../api';
import { 
    Users, UserPlus, Clock, CreditCard, Calendar, Award, FileText, 
    Search, Filter, CheckCircle, AlertCircle, Eye, Printer, Download,
    Check, X, ChevronRight, Phone, Mail, MapPin, Building, DollarSign,
    Briefcase, Shield, ArrowUpRight, Plus, Trash2, Edit3, UserCheck,
    FileCheck, Send, Sparkles, TrendingUp
} from 'lucide-react';
import { 
    Employee, AttendanceRecord, PayrollSlip, LeaveRequest, PerformanceReview, HRDocument,
    EmployeeDepartment, EmployeeRole, EmploymentType, EmployeeStatus, formatCurrency
} from '../../types';
import { hrService, calculatePayslip } from '../../services/hrService';

type HRSubTab = 'employees' | 'attendance' | 'payroll' | 'leave' | 'performance' | 'documents' | 'training' | 'recruitment';

export const HRTab: React.FC = () => {
    const { user, showToast, traders, refreshData } = useAppContext();
    const [subTab, setSubTab] = useState<HRSubTab>('employees');

    const currentTrader = traders.find(t => t.id === user?.traderId);
    const isHrActive = Boolean(currentTrader?.hrActive ?? user?.hrActive);

    // State data
    const [employees, setEmployees] = useState<Employee[]>([]);
    const [attendance, setAttendance] = useState<AttendanceRecord[]>([]);
    const [payroll, setPayroll] = useState<PayrollSlip[]>([]);
    const [leaveRequests, setLeaveRequests] = useState<LeaveRequest[]>([]);
    const [performanceReviews, setPerformanceReviews] = useState<PerformanceReview[]>([]);
    const [documents, setDocuments] = useState<HRDocument[]>([]);
    const [trainingPrograms, setTrainingPrograms] = useState([
        { id: 1, title: 'POS Terminal Proficiency', date: '2026-10-15', status: 'Upcoming', participants: 5 },
        { id: 2, title: 'Customer Service Excellence', date: '2026-09-20', status: 'Completed', participants: 12 },
        { id: 3, title: 'Inventory Compliance & Auditing', date: '2026-11-02', status: 'Planned', participants: 4 }
    ]);
    const [jobOpenings, setJobRecruitment] = useState([
        { id: 1, role: 'Lead Cashier', dept: 'Sales', status: 'Active', applicants: 8 },
        { id: 2, role: 'Inventory Clerk', dept: 'Logistics', status: 'Paused', applicants: 3 },
        { id: 3, role: 'Shift Manager', dept: 'Administration', status: 'Open', applicants: 15 }
    ]);

    // Modals
    const [isEmployeeModalOpen, setIsEmployeeModalOpen] = useState(false);
    const [editingEmployee, setEditingEmployee] = useState<Employee | null>(null);
    const [selectedEmployeeProfile, setSelectedEmployeeProfile] = useState<Employee | null>(null);

    const [isAttendanceModalOpen, setIsAttendanceModalOpen] = useState(false);
    const [isLeaveModalOpen, setIsLeaveModalOpen] = useState(false);
    const [isPerformanceModalOpen, setIsPerformanceModalOpen] = useState(false);
    const [isDocModalOpen, setIsDocModalOpen] = useState(false);
    const [activePayslip, setActivePayslip] = useState<PayrollSlip | null>(null);

    // Filters
    const [searchQuery, setSearchQuery] = useState('');
    const [selectedDept, setSelectedDept] = useState<string>('all');
    const [selectedStatus, setSelectedStatus] = useState<string>('all');

    // Refresh all data
    const refreshAll = () => {
        setEmployees(hrService.getEmployees());
        setAttendance(hrService.getAttendance());
        setPayroll(hrService.getPayroll());
        setLeaveRequests(hrService.getLeaveRequests());
        setPerformanceReviews(hrService.getPerformanceReviews());
        setDocuments(hrService.getDocuments());
    };

    useEffect(() => {
        refreshAll();
    }, []);

    // Summary Metrics
    const metrics = useMemo(() => {
        const activeCount = employees.filter(e => e.status === 'active').length;
        const onLeaveCount = employees.filter(e => e.status === 'on_leave').length;
        
        // Attendance today
        const todayStr = new Date().toISOString().split('T')[0];
        const todayRecords = attendance.filter(a => a.date === todayStr);
        const presentToday = todayRecords.filter(a => a.status === 'present' || a.status === 'late').length;
        const attendanceRate = activeCount > 0 ? Math.round((presentToday / activeCount) * 100) : 0;

        // Total monthly payroll gross & net
        const currentPayroll = payroll.filter(p => p.periodMonth === 'September' && p.periodYear === 2026);
        const monthlyGross = currentPayroll.reduce((sum, p) => sum + p.grossPay, 0);
        const monthlyNet = currentPayroll.reduce((sum, p) => sum + p.netPay, 0);
        const monthlyPAYE = currentPayroll.reduce((sum, p) => sum + p.payeTax, 0);

        // Pending leaves
        const pendingLeaves = leaveRequests.filter(l => l.status === 'pending').length;

        // Average performance rating
        const avgRating = performanceReviews.length > 0 
            ? (performanceReviews.reduce((sum, r) => sum + r.overallRating, 0) / performanceReviews.length).toFixed(1)
            : '4.5';

        return {
            totalStaff: employees.length,
            activeCount,
            onLeaveCount,
            presentToday,
            attendanceRate,
            monthlyGross,
            monthlyNet,
            monthlyPAYE,
            pendingLeaves,
            avgRating
        };
    }, [employees, attendance, payroll, leaveRequests, performanceReviews]);

    // Filtered Employees
    const filteredEmployees = useMemo(() => {
        return employees.filter(e => {
            const matchesSearch = 
                e.fullName.toLowerCase().includes(searchQuery.toLowerCase()) ||
                e.employeeNo.toLowerCase().includes(searchQuery.toLowerCase()) ||
                e.jobTitle.toLowerCase().includes(searchQuery.toLowerCase()) ||
                e.phone.includes(searchQuery);
            const matchesDept = selectedDept === 'all' || e.department === selectedDept;
            const matchesStatus = selectedStatus === 'all' || e.status === selectedStatus;
            return matchesSearch && matchesDept && matchesStatus;
        });
    }, [employees, searchQuery, selectedDept, selectedStatus]);

    // Handlers
    const handleSaveEmployee = (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        const fd = new FormData(e.currentTarget);
        const empData: Partial<Employee> = {
            id: editingEmployee ? editingEmployee.id : undefined,
            fullName: fd.get('fullName') as string,
            email: fd.get('email') as string,
            phone: fd.get('phone') as string,
            nationalId: fd.get('nationalId') as string,
            gender: fd.get('gender') as any,
            dateOfBirth: fd.get('dateOfBirth') as string,
            residence: fd.get('residence') as string,
            department: fd.get('department') as EmployeeDepartment,
            jobTitle: fd.get('jobTitle') as string,
            role: fd.get('role') as EmployeeRole,
            status: (fd.get('status') as EmployeeStatus) || 'active',
            employmentType: fd.get('employmentType') as EmploymentType,
            workStation: fd.get('workStation') as string,
            basicSalary: Number(fd.get('basicSalary')) || 40000,
            housingAllowance: Number(fd.get('housingAllowance')) || 0,
            transportAllowance: Number(fd.get('transportAllowance')) || 0,
            commissionRate: Number(fd.get('commissionRate')) || 0,
            kraPin: fd.get('kraPin') as string,
            nssfNo: fd.get('nssfNo') as string,
            nhifNo: fd.get('nhifNo') as string,
            paymentMethod: fd.get('paymentMethod') as any,
            bankName: fd.get('bankName') as string,
            bankAccountNo: fd.get('bankAccountNo') as string,
            mpesaPhone: fd.get('mpesaPhone') as string,
            emergencyContactName: fd.get('emergencyContactName') as string,
            emergencyContactPhone: fd.get('emergencyContactPhone') as string,
            notes: fd.get('notes') as string,
        };

        hrService.saveEmployee(empData);
        showToast(editingEmployee ? 'Staff profile updated successfully' : 'Employee onboarded successfully', 'success');
        setIsEmployeeModalOpen(false);
        setEditingEmployee(null);
        refreshAll();
    };

    const handleSaveAttendance = (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        const fd = new FormData(e.currentTarget);
        const empId = Number(fd.get('employeeId'));
        const emp = employees.find(x => x.id === empId);

        const recData: Partial<AttendanceRecord> = {
            employeeId: empId,
            employeeName: emp ? emp.fullName : 'Staff Member',
            date: fd.get('date') as string,
            clockInTime: fd.get('clockInTime') as string,
            clockOutTime: fd.get('clockOutTime') as string || undefined,
            shift: fd.get('shift') as any,
            workstation: fd.get('workstation') as string,
            hoursWorked: Number(fd.get('hoursWorked')) || 8,
            overtimeHours: Number(fd.get('overtimeHours')) || 0,
            status: fd.get('status') as any,
            notes: fd.get('notes') as string,
        };

        hrService.saveAttendance(recData);
        showToast('Attendance logged successfully', 'success');
        setIsAttendanceModalOpen(false);
        refreshAll();
    };

    const handleQuickClockIn = (emp: Employee) => {
        const nowTime = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        hrService.saveAttendance({
            employeeId: emp.id,
            employeeName: emp.fullName,
            date: new Date().toISOString().split('T')[0],
            clockInTime: nowTime,
            shift: 'Full Day (08:00-17:00)',
            workstation: emp.workStation || 'Main Branch',
            hoursWorked: 8,
            overtimeHours: 0,
            status: 'present',
            notes: 'Quick Clock-In from HR Terminal'
        });
        showToast(`${emp.fullName} clocked in at ${nowTime}`, 'success');
        refreshAll();
    };

    const handleApplyLeave = (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        const fd = new FormData(e.currentTarget);
        const empId = Number(fd.get('employeeId'));
        const emp = employees.find(x => x.id === empId);

        const leaveData: Partial<LeaveRequest> = {
            employeeId: empId,
            employeeName: emp ? emp.fullName : 'Staff Member',
            department: emp?.department,
            leaveType: fd.get('leaveType') as any,
            startDate: fd.get('startDate') as string,
            endDate: fd.get('endDate') as string,
            days: Number(fd.get('days')) || 1,
            reason: fd.get('reason') as string,
            handoverTo: fd.get('handoverTo') as string,
        };

        hrService.saveLeaveRequest(leaveData);
        showToast('Leave request submitted successfully', 'success');
        setIsLeaveModalOpen(false);
        refreshAll();
    };

    const handleApproveLeave = (id: number) => {
        hrService.updateLeaveStatus(id, 'approved', 'Approved by Management', user?.username || 'HR Admin');
        showToast('Leave request approved', 'success');
        refreshAll();
    };

    const handleRejectLeave = (id: number) => {
        hrService.updateLeaveStatus(id, 'rejected', 'Declined due to peak shift requirement', user?.username || 'HR Admin');
        showToast('Leave request declined', 'info');
        refreshAll();
    };

    const handleSavePerformance = (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        const fd = new FormData(e.currentTarget);
        const empId = Number(fd.get('employeeId'));
        const emp = employees.find(x => x.id === empId);

        const revData: Partial<PerformanceReview> = {
            employeeId: empId,
            employeeName: emp ? emp.fullName : 'Staff Member',
            jobTitle: emp?.jobTitle,
            reviewPeriod: fd.get('reviewPeriod') as string,
            salesVolume: Number(fd.get('salesVolume')) || 0,
            transactionsHandled: Number(fd.get('transactionsHandled')) || 0,
            punctualityScore: Number(fd.get('punctualityScore')) || 5,
            customerServiceScore: Number(fd.get('customerServiceScore')) || 5,
            accuracyScore: Number(fd.get('accuracyScore')) || 5,
            teamworkScore: Number(fd.get('teamworkScore')) || 5,
            strengths: fd.get('strengths') as string,
            areasForImprovement: fd.get('areasForImprovement') as string,
            goals: fd.get('goals') as string,
            reviewer: user?.username || 'HR Lead'
        };

        hrService.savePerformanceReview(revData);
        showToast('Performance appraisal recorded', 'success');
        setIsPerformanceModalOpen(false);
        refreshAll();
    };

    const handleSaveDocument = (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        const fd = new FormData(e.currentTarget);
        const empIdVal = fd.get('employeeId');
        const empId = empIdVal ? Number(empIdVal) : undefined;
        const emp = empId ? employees.find(x => x.id === empId) : undefined;

        hrService.saveDocument({
            title: fd.get('title') as string,
            category: fd.get('category') as any,
            employeeId: empId,
            employeeName: emp?.fullName,
            expiryDate: (fd.get('expiryDate') as string) || undefined,
            fileSize: `${(Math.random() * 2 + 0.5).toFixed(1)} MB`,
            status: 'valid'
        });
        showToast('Document cataloged in secure registry', 'success');
        setIsDocModalOpen(false);
        refreshAll();
    };

    const handleGeneratePayroll = () => {
        hrService.generateMonthlyPayroll('September', 2026);
        showToast('September 2026 Payroll Slips generated for active workforce', 'success');
        refreshAll();
    };

    const handleMarkSlipPaid = (slip: PayrollSlip) => {
        const ref = `EFT-TX-${Math.floor(100000 + Math.random() * 900000)}`;
        const updated: PayrollSlip = {
            ...slip,
            paymentStatus: 'paid',
            paymentDate: new Date().toISOString().split('T')[0],
            paymentReference: ref
        };
        hrService.savePayrollSlip(updated);
        showToast(`Payslip ${slip.slipNo} marked as PAID (${ref})`, 'success');
        refreshAll();
        if (activePayslip && activePayslip.id === slip.id) {
            setActivePayslip(updated);
        }
    };

    return (
        <div className="flex flex-col h-full space-y-3 md:space-y-4">
            {/* Optional Add-on Module Status / Activation Banner */}
            <div className={`p-4 rounded-2xl border transition-all ${
                isHrActive 
                    ? 'bg-gradient-to-r from-purple-950/40 to-slate-900 border-purple-500/30 text-purple-200' 
                    : 'bg-gradient-to-r from-purple-950/90 via-slate-900 to-indigo-950 border-2 border-purple-500/60 text-white shadow-xl shadow-purple-950/50'
            }`}>
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div className="flex items-center gap-3.5">
                        <div className={`w-10 h-10 rounded-xl flex items-center justify-center font-bold shrink-0 ${
                            isHrActive 
                                ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' 
                                : 'bg-purple-500/30 text-purple-300 border border-purple-400/40'
                        }`}>
                            <UserCheck size={20} />
                        </div>
                        <div>
                            <div className="flex items-center gap-2 flex-wrap">
                                <span className="text-[10px] font-black uppercase tracking-wider bg-purple-500/30 text-purple-300 px-2.5 py-0.5 rounded-full border border-purple-400/30">
                                    Optional Add-on Module (+50% fee of plan cost each) - on subscription
                                </span>
                                {isHrActive ? (
                                    <span className="text-[10px] font-bold text-emerald-400 flex items-center gap-1 bg-emerald-500/20 px-2 py-0.5 rounded-full border border-emerald-500/30">
                                        <Check size={12} /> Active on Subscription
                                    </span>
                                ) : (
                                    <span className="text-[10px] font-bold text-amber-300 flex items-center gap-1 bg-amber-500/20 px-2 py-0.5 rounded-full border border-amber-500/30">
                                        Add-on Inactive / Preview Mode
                                    </span>
                                )}
                            </div>
                            <p className="text-xs text-slate-300 mt-1">
                                {isHrActive 
                                    ? 'HR Module is active (+50% tier fee applied). You have unrestricted access to staff management, attendance shifts, PAYE/NSSF/NHIF statutory payroll, and performance records.' 
                                    : 'Staff management, biometric shift attendance, statutory East African payroll (KRA PAYE / NSSF / NHIF / Housing Levy), and appraisals are available as an add-on (+50% fee of your subscription plan).'}
                            </p>
                        </div>
                    </div>
                    {!isHrActive && (
                        <button
                            onClick={async () => {
                                try {
                                    const res = await api.activateModule('hr');
                                    if (res.success) {
                                        showToast('HR Module activated successfully! (+50% fee added to plan subscription)', 'success');
                                        await refreshData();
                                    }
                                } catch (e) {
                                    showToast('Failed to activate HR Module', 'error');
                                }
                            }}
                            className="px-4 py-2.5 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white font-black text-xs rounded-xl shadow-lg shadow-purple-900/40 transition flex items-center gap-2 shrink-0 cursor-pointer"
                        >
                            <Sparkles size={14} />
                            Activate HR Module (+50% Plan Fee)
                        </button>
                    )}
                </div>
            </div>

            {/* Top Operational Header */}
            <div className="bg-slate-900 border-l-4 border-indigo-500 rounded-2xl p-4 md:px-6 md:py-4 text-white shadow-xl relative overflow-hidden shrink-0">
                <div className="absolute top-0 right-0 w-80 h-80 bg-indigo-500/10 rounded-full blur-3xl -mr-40 -mt-40 pointer-events-none" />
                <div className="relative z-10 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
                    <div className="flex items-center gap-3.5">
                        <div className="w-12 h-12 bg-indigo-600/20 rounded-2xl flex items-center justify-center border border-indigo-500/30 text-indigo-400 shrink-0">
                            <Users size={26} />
                        </div>
                        <div>
                            <div className="flex items-center gap-2">
                                <span className="text-[10px] font-black uppercase tracking-[0.3em] text-indigo-400">Human Capital & Workforce Management</span>
                                <span className="text-[9px] font-black bg-emerald-500/20 text-emerald-400 px-2 py-0.5 rounded border border-emerald-500/30 uppercase tracking-widest hidden sm:inline-block">
                                    Statutory East Africa Compliant
                                </span>
                            </div>
                            <h2 className="text-lg md:text-xl font-black uppercase tracking-tight text-white flex items-center gap-2 mt-0.5">
                                HR Operations & Payroll Hub
                            </h2>
                            <p className="text-[11px] text-slate-400 font-medium max-w-2xl">
                                Complete employee lifecycle management: digital contracts, live biometric/shift attendance, Kenya KRA PAYE / NSSF / NHIF statutory deductions, leave entitlements, and staff performance appraisals.
                            </p>
                        </div>
                    </div>

                    <div className="flex items-center gap-2 self-stretch md:self-auto justify-end">
                        <button 
                            onClick={() => {
                                setEditingEmployee(null);
                                setIsEmployeeModalOpen(true);
                            }}
                            className="tech-button !px-3.5 !py-2 !text-xs flex items-center gap-1.5 shadow-lg shadow-indigo-600/25"
                        >
                            <UserPlus size={14} />
                            <span>Onboard Staff</span>
                        </button>
                    </div>
                </div>

                {/* Live KPI Metric Cards */}
                <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-5 gap-2.5 mt-4 pt-3 border-t border-slate-800/80">
                    <div className="bg-slate-800/60 p-2.5 rounded-xl border border-slate-700/60">
                        <div className="text-[9px] font-black text-slate-400 uppercase tracking-wider">Active Workforce</div>
                        <div className="text-lg font-black text-white mt-0.5 flex items-baseline gap-1.5">
                            {metrics.activeCount} <span className="text-[10px] text-slate-400 font-normal">/ {metrics.totalStaff} staff</span>
                        </div>
                        <div className="text-[9px] text-emerald-400 font-bold mt-0.5">{metrics.onLeaveCount} on approved leave</div>
                    </div>

                    <div className="bg-slate-800/60 p-2.5 rounded-xl border border-slate-700/60">
                        <div className="text-[9px] font-black text-slate-400 uppercase tracking-wider">Today's Attendance</div>
                        <div className="text-lg font-black text-emerald-400 mt-0.5 flex items-baseline gap-1">
                            {metrics.attendanceRate}%
                        </div>
                        <div className="text-[9px] text-slate-400 font-bold mt-0.5">{metrics.presentToday} on active duty</div>
                    </div>

                    <div className="bg-slate-800/60 p-2.5 rounded-xl border border-slate-700/60">
                        <div className="text-[9px] font-black text-slate-400 uppercase tracking-wider">Monthly Net Payroll</div>
                        <div className="text-lg font-black text-indigo-400 mt-0.5 truncate">
                            {formatCurrency(metrics.monthlyNet)}
                        </div>
                        <div className="text-[9px] text-slate-400 font-bold mt-0.5">Gross: {formatCurrency(metrics.monthlyGross)}</div>
                    </div>

                    <div className="bg-slate-800/60 p-2.5 rounded-xl border border-slate-700/60">
                        <div className="text-[9px] font-black text-slate-400 uppercase tracking-wider">Pending Leaves</div>
                        <div className={`text-lg font-black mt-0.5 ${metrics.pendingLeaves > 0 ? 'text-amber-400' : 'text-slate-300'}`}>
                            {metrics.pendingLeaves} requests
                        </div>
                        <div className="text-[9px] text-slate-400 font-bold mt-0.5">Requires approval</div>
                    </div>

                    <div className="bg-slate-800/60 p-2.5 rounded-xl border border-slate-700/60 col-span-2 sm:col-span-1">
                        <div className="text-[9px] font-black text-slate-400 uppercase tracking-wider">Avg Staff Appraisal</div>
                        <div className="text-lg font-black text-amber-300 mt-0.5 flex items-center gap-1">
                            ⭐ {metrics.avgRating} <span className="text-[10px] text-slate-400 font-normal">/ 5.0</span>
                        </div>
                        <div className="text-[9px] text-slate-400 font-bold mt-0.5">High Performance</div>
                    </div>
                </div>
            </div>

            {/* Navigation Sub-Tabs Bar */}
            <div className="flex items-center gap-1 border-b border-slate-200 bg-white px-3 py-1.5 rounded-xl shadow-sm overflow-x-auto custom-scrollbar shrink-0">
                <button
                    onClick={() => setSubTab('employees')}
                    className={`flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-black uppercase tracking-wider whitespace-nowrap transition-all ${
                        subTab === 'employees' 
                            ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/25' 
                            : 'text-slate-600 hover:bg-slate-100'
                    }`}
                >
                    <Users size={15} />
                    <span>Staff Directory ({employees.length})</span>
                </button>

                <button
                    onClick={() => setSubTab('attendance')}
                    className={`flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-black uppercase tracking-wider whitespace-nowrap transition-all ${
                        subTab === 'attendance' 
                            ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/25' 
                            : 'text-slate-600 hover:bg-slate-100'
                    }`}
                >
                    <Clock size={15} />
                    <span>Shift Attendance ({attendance.length})</span>
                </button>

                <button
                    onClick={() => setSubTab('payroll')}
                    className={`flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-black uppercase tracking-wider whitespace-nowrap transition-all ${
                        subTab === 'payroll' 
                            ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/25' 
                            : 'text-slate-600 hover:bg-slate-100'
                    }`}
                >
                    <CreditCard size={15} />
                    <span>Payroll & Payslips ({payroll.length})</span>
                </button>

                <button
                    onClick={() => setSubTab('leave')}
                    className={`flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-black uppercase tracking-wider whitespace-nowrap transition-all ${
                        subTab === 'leave' 
                            ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/25' 
                            : 'text-slate-600 hover:bg-slate-100'
                    }`}
                >
                    <Calendar size={15} />
                    <span>Leave Management</span>
                    {metrics.pendingLeaves > 0 && (
                        <span className="bg-amber-500 text-white text-[10px] px-1.5 py-0.2 rounded-full font-black">
                            {metrics.pendingLeaves}
                        </span>
                    )}
                </button>

                <button
                    onClick={() => setSubTab('performance')}
                    className={`flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-black uppercase tracking-wider whitespace-nowrap transition-all ${
                        subTab === 'performance' 
                            ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/25' 
                            : 'text-slate-600 hover:bg-slate-100'
                    }`}
                >
                    <Award size={15} />
                    <span>Appraisals & Reviews ({performanceReviews.length})</span>
                </button>

                <button
                    onClick={() => setSubTab('documents')}
                    className={`flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-black uppercase tracking-wider whitespace-nowrap transition-all ${
                        subTab === 'documents' 
                            ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/25' 
                            : 'text-slate-600 hover:bg-slate-100'
                    }`}
                >
                    <FileText size={15} />
                    <span>HR Compliance & Docs ({documents.length})</span>
                </button>

                <button
                    onClick={() => setSubTab('training')}
                    className={`flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-black uppercase tracking-wider whitespace-nowrap transition-all ${
                        subTab === 'training' 
                            ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/25' 
                            : 'text-slate-600 hover:bg-slate-100'
                    }`}
                >
                    <Award size={15} />
                    <span>Training & Upskilling ({trainingPrograms.length})</span>
                </button>

                <button
                    onClick={() => setSubTab('recruitment')}
                    className={`flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-black uppercase tracking-wider whitespace-nowrap transition-all ${
                        subTab === 'recruitment' 
                            ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/25' 
                            : 'text-slate-600 hover:bg-slate-100'
                    }`}
                >
                    <UserPlus size={15} />
                    <span>Recruitment & Hiring ({jobOpenings.length})</span>
                </button>
            </div>

            {/* Sub-Tab View Content */}
            <div className="flex-1 min-h-0 bg-white rounded-2xl border border-slate-200 p-3 sm:p-4 overflow-y-auto custom-scrollbar shadow-sm">
                {/* Training Tab Content */}
                {subTab === 'training' && (
                    <div className="space-y-4">
                        <div className="flex items-center justify-between">
                            <h3 className="text-base font-black text-slate-900 flex items-center gap-2">
                                <Award size={18} className="text-indigo-600" /> Staff Development & Training Programs
                            </h3>
                            <button className="tech-button !px-3 !py-1.5 !text-[10px]">New Training Batch</button>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                            {trainingPrograms.map(t => (
                                <div key={t.id} className="bg-slate-50 border border-slate-200 rounded-xl p-4">
                                    <div className="flex justify-between items-start mb-2">
                                        <span className={`text-[9px] font-black uppercase px-2 py-0.5 rounded-full ${t.status === 'Completed' ? 'bg-emerald-100 text-emerald-800' : 'bg-blue-100 text-blue-800'}`}>
                                            {t.status}
                                        </span>
                                        <span className="text-[10px] text-slate-400 font-bold">{t.date}</span>
                                    </div>
                                    <h4 className="font-black text-slate-800 text-sm">{t.title}</h4>
                                    <p className="text-xs text-slate-500 mt-1">Participants: <strong>{t.participants} staff</strong></p>
                                    <button className="text-[10px] font-black text-indigo-600 uppercase mt-3">View Syllabus</button>
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {/* Recruitment Tab Content */}
                {subTab === 'recruitment' && (
                    <div className="space-y-4">
                        <div className="flex items-center justify-between">
                            <h3 className="text-base font-black text-slate-900 flex items-center gap-2">
                                <Users size={18} className="text-indigo-600" /> Talent Acquisition & Job Openings
                            </h3>
                            <button className="tech-button !px-3 !py-1.5 !text-[10px]">Post Job Opening</button>
                        </div>
                        <div className="overflow-x-auto rounded-xl border border-slate-200">
                            <table className="w-full text-left text-xs">
                                <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 uppercase font-black text-[10px]">
                                    <tr>
                                        <th className="p-3">Job Role</th>
                                        <th className="p-3">Department</th>
                                        <th className="p-3">Status</th>
                                        <th className="p-3">Applicants</th>
                                        <th className="p-3 text-right">Actions</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100">
                                    {jobOpenings.map(j => (
                                        <tr key={j.id} className="hover:bg-slate-50">
                                            <td className="p-3 font-bold text-slate-900">{j.role}</td>
                                            <td className="p-3 text-slate-600">{j.dept}</td>
                                            <td className="p-3">
                                                <span className={`px-2 py-0.5 rounded-full text-[9px] font-black uppercase ${j.status === 'Active' ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-100 text-slate-500'}`}>
                                                    {j.status}
                                                </span>
                                            </td>
                                            <td className="p-3 font-bold text-indigo-600">{j.applicants} applied</td>
                                            <td className="p-3 text-right">
                                                <button className="text-indigo-600 font-black uppercase text-[10px]">Review CVs</button>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                )}

                {/* 1. EMPLOYEES DIRECTORY */}
                {subTab === 'employees' && (
                    <div className="space-y-4">
                        {/* Filters & Action Bar */}
                        <div className="flex flex-col sm:flex-row gap-2.5 justify-between items-stretch sm:items-center">
                            <div className="flex flex-1 items-center gap-2">
                                <div className="relative flex-1 max-w-sm">
                                    <Search size={14} className="absolute left-3 top-3 text-slate-400" />
                                    <input 
                                        type="text" 
                                        placeholder="Search by name, ID, phone..."
                                        value={searchQuery}
                                        onChange={e => setSearchQuery(e.target.value)}
                                        className="w-full bg-slate-50 border border-slate-200 rounded-lg pl-9 pr-3 py-2 text-xs font-semibold focus:outline-none focus:border-indigo-500"
                                    />
                                    {searchQuery && (
                                        <button onClick={() => setSearchQuery('')} className="absolute right-2.5 top-2.5 text-xs text-slate-400">✕</button>
                                    )}
                                </div>

                                <select 
                                    value={selectedDept}
                                    onChange={e => setSelectedDept(e.target.value)}
                                    className="bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-2 text-xs font-semibold text-slate-700"
                                >
                                    <option value="all">All Departments</option>
                                    <option value="Sales & POS">Sales & POS</option>
                                    <option value="Inventory & Logistics">Inventory & Logistics</option>
                                    <option value="Accounts & Finance">Accounts & Finance</option>
                                    <option value="Production & Workshop">Production & Workshop</option>
                                    <option value="Administration">Administration</option>
                                    <option value="Customer Support">Customer Support</option>
                                </select>

                                <select 
                                    value={selectedStatus}
                                    onChange={e => setSelectedStatus(e.target.value)}
                                    className="bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-2 text-xs font-semibold text-slate-700"
                                >
                                    <option value="all">All Statuses</option>
                                    <option value="active">Active</option>
                                    <option value="on_leave">On Leave</option>
                                    <option value="suspended">Suspended</option>
                                    <option value="terminated">Terminated</option>
                                </select>
                            </div>

                            <button
                                onClick={() => {
                                    setEditingEmployee(null);
                                    setIsEmployeeModalOpen(true);
                                }}
                                className="tech-button !px-3 !py-2 !text-xs whitespace-nowrap flex items-center justify-center gap-1.5"
                            >
                                <Plus size={14} /> Onboard New Employee
                            </button>
                        </div>

                        {/* Employee Cards Grid */}
                        {filteredEmployees.length === 0 ? (
                            <div className="text-center py-12 text-slate-400">
                                <Users size={40} className="mx-auto mb-2 opacity-20" />
                                <p className="font-bold">No employees found matching filter criteria.</p>
                            </div>
                        ) : (
                            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
                                {filteredEmployees.map(emp => (
                                    <div 
                                        key={emp.id}
                                        className="bg-white border border-slate-200 rounded-xl p-3.5 shadow-sm hover:border-indigo-400/50 hover:shadow-md transition-all flex flex-col justify-between"
                                    >
                                        <div>
                                            <div className="flex items-start justify-between gap-2">
                                                <div className="flex items-center gap-3">
                                                    <div className="w-10 h-10 rounded-full bg-indigo-50 border border-indigo-200 text-indigo-700 flex items-center justify-center font-black text-sm shrink-0">
                                                        {emp.fullName.split(' ').map(n => n[0]).join('').slice(0, 2)}
                                                    </div>
                                                    <div>
                                                        <h4 className="font-black text-slate-900 text-sm">{emp.fullName}</h4>
                                                        <div className="text-[10px] font-mono text-indigo-600 font-bold">{emp.employeeNo} • {emp.jobTitle}</div>
                                                    </div>
                                                </div>
                                                <span className={`text-[9px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full ${
                                                    emp.status === 'active' ? 'bg-emerald-100 text-emerald-800' :
                                                    emp.status === 'on_leave' ? 'bg-amber-100 text-amber-800' : 'bg-rose-100 text-rose-800'
                                                }`}>
                                                    {emp.status.replace('_', ' ')}
                                                </span>
                                            </div>

                                            <div className="grid grid-cols-2 gap-2 mt-3 pt-3 border-t border-slate-100 text-xs">
                                                <div>
                                                    <span className="text-[9px] text-slate-400 font-black uppercase block">Department</span>
                                                    <span className="font-bold text-slate-700 text-[11px] truncate block">{emp.department}</span>
                                                </div>
                                                <div>
                                                    <span className="text-[9px] text-slate-400 font-black uppercase block">Basic Salary</span>
                                                    <span className="font-bold text-slate-900 text-[11px]">{formatCurrency(emp.basicSalary)}</span>
                                                </div>
                                                <div>
                                                    <span className="text-[9px] text-slate-400 font-black uppercase block">Phone / M-Pesa</span>
                                                    <span className="font-bold text-slate-700 text-[11px]">{emp.phone}</span>
                                                </div>
                                                <div>
                                                    <span className="text-[9px] text-slate-400 font-black uppercase block">Work Station</span>
                                                    <span className="font-bold text-slate-700 text-[11px] truncate block">{emp.workStation || 'Main Branch'}</span>
                                                </div>
                                            </div>
                                        </div>

                                        <div className="flex items-center justify-between gap-1.5 mt-3 pt-2.5 border-t border-slate-100">
                                            <button 
                                                onClick={() => setSelectedEmployeeProfile(emp)}
                                                className="text-[10px] font-black uppercase tracking-wider text-indigo-600 hover:text-indigo-800 flex items-center gap-1"
                                            >
                                                <Eye size={12} /> Profile Card
                                            </button>

                                            <div className="flex items-center gap-1">
                                                <button
                                                    onClick={() => handleQuickClockIn(emp)}
                                                    className="p-1.5 bg-slate-100 hover:bg-emerald-50 text-slate-600 hover:text-emerald-700 rounded-lg text-[10px] font-bold transition-colors"
                                                    title="Quick Clock In for Today"
                                                >
                                                    <Clock size={13} />
                                                </button>
                                                <button
                                                    onClick={() => {
                                                        setEditingEmployee(emp);
                                                        setIsEmployeeModalOpen(true);
                                                    }}
                                                    className="p-1.5 bg-slate-100 hover:bg-indigo-50 text-slate-600 hover:text-indigo-700 rounded-lg text-[10px] font-bold transition-colors"
                                                    title="Edit Employee Information"
                                                >
                                                    <Edit3 size={13} />
                                                </button>
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                )}

                {/* 2. ATTENDANCE & LIVE CLOCK-IN */}
                {subTab === 'attendance' && (
                    <div className="space-y-4">
                        <div className="flex flex-col sm:flex-row justify-between items-stretch sm:items-center gap-2">
                            <div>
                                <h3 className="text-base font-black text-slate-900 flex items-center gap-2">
                                    <Clock size={18} className="text-indigo-600" /> Daily Biometric & Shift Roster
                                </h3>
                                <p className="text-xs text-slate-500">Record check-ins, calculate shift hours, and monitor staff overtime.</p>
                            </div>
                            <div className="flex items-center gap-2">
                                <button 
                                    onClick={() => setIsAttendanceModalOpen(true)}
                                    className="tech-button !px-3 !py-2 !text-xs flex items-center gap-1.5"
                                >
                                    <Plus size={14} /> Log Manual Shift
                                </button>
                            </div>
                        </div>

                        <div className="overflow-x-auto rounded-xl border border-slate-200">
                            <table className="w-full text-left text-xs">
                                <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 uppercase tracking-wider font-black text-[10px]">
                                    <tr>
                                        <th className="p-3">Staff Member</th>
                                        <th className="p-3">Date</th>
                                        <th className="p-3">Shift & Work Station</th>
                                        <th className="p-3">Clock In</th>
                                        <th className="p-3">Clock Out</th>
                                        <th className="p-3">Hours / Overtime</th>
                                        <th className="p-3">Status</th>
                                        <th className="p-3">Notes</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100 font-medium text-slate-700">
                                    {attendance.map(rec => (
                                        <tr key={rec.id} className="hover:bg-slate-50/80 transition-colors">
                                            <td className="p-3 font-bold text-slate-900 flex items-center gap-2">
                                                <UserCheck size={14} className="text-indigo-600" />
                                                <span>{rec.employeeName}</span>
                                            </td>
                                            <td className="p-3 font-mono">{rec.date}</td>
                                            <td className="p-3">
                                                <span className="font-bold block">{rec.shift}</span>
                                                <span className="text-[10px] text-slate-400">{rec.workstation}</span>
                                            </td>
                                            <td className="p-3 font-bold text-emerald-700">{rec.clockInTime}</td>
                                            <td className="p-3 font-bold text-slate-600">{rec.clockOutTime || '— In Shift —'}</td>
                                            <td className="p-3">
                                                <span className="font-bold">{rec.hoursWorked || 8} hrs</span>
                                                {rec.overtimeHours ? (
                                                    <span className="text-[10px] text-indigo-600 font-bold block">+{rec.overtimeHours} OT</span>
                                                ) : null}
                                            </td>
                                            <td className="p-3">
                                                <span className={`px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider ${
                                                    rec.status === 'present' ? 'bg-emerald-100 text-emerald-800' :
                                                    rec.status === 'late' ? 'bg-amber-100 text-amber-800' :
                                                    rec.status === 'on_leave' ? 'bg-blue-100 text-blue-800' : 'bg-rose-100 text-rose-800'
                                                }`}>
                                                    {rec.status.replace('_', ' ')}
                                                </span>
                                            </td>
                                            <td className="p-3 text-[11px] text-slate-500 max-w-xs truncate">{rec.notes || '—'}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                )}

                {/* 3. PAYROLL & PAYSLIPS */}
                {subTab === 'payroll' && (
                    <div className="space-y-4">
                        <div className="flex flex-col sm:flex-row justify-between items-stretch sm:items-center gap-2">
                            <div>
                                <h3 className="text-base font-black text-slate-900 flex items-center gap-2">
                                    <CreditCard size={18} className="text-indigo-600" /> Statutory Payroll Engine & Payslips
                                </h3>
                                <p className="text-xs text-slate-500">
                                    Calculates PAYE, NSSF Tier 1 & 2, NHIF rates, and 1.5% Affordable Housing Levy with itemized payslip printing.
                                </p>
                            </div>
                            <div className="flex items-center gap-2">
                                <button 
                                    onClick={handleGeneratePayroll}
                                    className="tech-button !px-3 !py-2 !text-xs flex items-center gap-1.5"
                                >
                                    <Sparkles size={14} /> Process Monthly Payroll Run
                                </button>
                            </div>
                        </div>

                        {/* Payroll Table */}
                        <div className="overflow-x-auto rounded-xl border border-slate-200">
                            <table className="w-full text-left text-xs">
                                <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 uppercase tracking-wider font-black text-[10px]">
                                    <tr>
                                        <th className="p-3">Slip #</th>
                                        <th className="p-3">Employee</th>
                                        <th className="p-3">Gross Pay</th>
                                        <th className="p-3">PAYE Tax</th>
                                        <th className="p-3">NSSF & NHIF</th>
                                        <th className="p-3">Housing Levy (1.5%)</th>
                                        <th className="p-3">Net Take-Home</th>
                                        <th className="p-3">Payment Status</th>
                                        <th className="p-3 text-right">Actions</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100 font-medium text-slate-700">
                                    {payroll.map(slip => (
                                        <tr key={slip.id} className="hover:bg-slate-50/80 transition-colors">
                                            <td className="p-3 font-mono font-bold text-indigo-600">{slip.slipNo}</td>
                                            <td className="p-3">
                                                <div className="font-bold text-slate-900">{slip.employeeName}</div>
                                                <div className="text-[10px] text-slate-400">{slip.jobTitle}</div>
                                            </td>
                                            <td className="p-3 font-bold text-slate-900">{formatCurrency(slip.grossPay)}</td>
                                            <td className="p-3 font-bold text-rose-600">-{formatCurrency(slip.payeTax)}</td>
                                            <td className="p-3 text-[11px]">
                                                <span>-{formatCurrency(slip.nssfDeduction + slip.nhifDeduction)}</span>
                                            </td>
                                            <td className="p-3 text-[11px] text-slate-600">-{formatCurrency(slip.housingLevy)}</td>
                                            <td className="p-3 font-black text-emerald-700 text-sm">
                                                {formatCurrency(slip.netPay)}
                                            </td>
                                            <td className="p-3">
                                                <span className={`px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider ${
                                                    slip.paymentStatus === 'paid' ? 'bg-emerald-100 text-emerald-800' :
                                                    slip.paymentStatus === 'approved' ? 'bg-blue-100 text-blue-800' : 'bg-slate-100 text-slate-700'
                                                }`}>
                                                    {slip.paymentStatus}
                                                </span>
                                            </td>
                                            <td className="p-3 text-right">
                                                <div className="flex items-center justify-end gap-1.5">
                                                    <button 
                                                        onClick={() => setActivePayslip(slip)}
                                                        className="px-2 py-1 bg-indigo-50 text-indigo-700 hover:bg-indigo-100 rounded text-[10px] font-black uppercase tracking-wider flex items-center gap-1 transition"
                                                        title="Preview & Print Payslip"
                                                    >
                                                        <Printer size={12} /> Payslip
                                                    </button>
                                                    {slip.paymentStatus !== 'paid' && (
                                                        <button 
                                                            onClick={() => handleMarkSlipPaid(slip)}
                                                            className="px-2 py-1 bg-emerald-600 text-white hover:bg-emerald-700 rounded text-[10px] font-black uppercase tracking-wider flex items-center gap-1 transition"
                                                            title="Disburse / Mark as Paid"
                                                        >
                                                            <Check size={12} /> Pay
                                                        </button>
                                                    )}
                                                </div>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                )}

                {/* 4. LEAVE MANAGEMENT */}
                {subTab === 'leave' && (
                    <div className="space-y-4">
                        <div className="flex flex-col sm:flex-row justify-between items-stretch sm:items-center gap-2">
                            <div>
                                <h3 className="text-base font-black text-slate-900 flex items-center gap-2">
                                    <Calendar size={18} className="text-indigo-600" /> Leave & Absence Approvals
                                </h3>
                                <p className="text-xs text-slate-500">Track annual leave balances, sick leaves, and manager signoffs.</p>
                            </div>
                            <button 
                                onClick={() => setIsLeaveModalOpen(true)}
                                className="tech-button !px-3 !py-2 !text-xs flex items-center gap-1.5"
                            >
                                <Plus size={14} /> New Leave Request
                            </button>
                        </div>

                        {/* Leave Request Cards */}
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                            {leaveRequests.map(req => (
                                <div key={req.id} className="bg-white border border-slate-200 rounded-xl p-3.5 shadow-sm space-y-2.5">
                                    <div className="flex items-start justify-between gap-2">
                                        <div>
                                            <div className="font-black text-slate-900 text-sm">{req.employeeName}</div>
                                            <div className="text-[10px] text-indigo-600 font-bold">{req.department}</div>
                                        </div>
                                        <span className={`px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider ${
                                            req.status === 'approved' ? 'bg-emerald-100 text-emerald-800' :
                                            req.status === 'rejected' ? 'bg-rose-100 text-rose-800' : 'bg-amber-100 text-amber-800'
                                        }`}>
                                            {req.status}
                                        </span>
                                    </div>

                                    <div className="bg-slate-50 p-2 rounded-lg border border-slate-100 text-xs space-y-1">
                                        <div className="flex justify-between font-bold">
                                            <span className="text-slate-500">Type:</span>
                                            <span className="text-indigo-700">{req.leaveType}</span>
                                        </div>
                                        <div className="flex justify-between font-bold">
                                            <span className="text-slate-500">Duration:</span>
                                            <span className="text-slate-800">{req.days} days ({req.startDate} to {req.endDate})</span>
                                        </div>
                                        {req.handoverTo && (
                                            <div className="flex justify-between text-[11px]">
                                                <span className="text-slate-500">Handover to:</span>
                                                <span className="text-slate-700 font-medium">{req.handoverTo}</span>
                                            </div>
                                        )}
                                    </div>

                                    <p className="text-xs text-slate-600 italic line-clamp-2">"{req.reason}"</p>

                                    {req.status === 'pending' ? (
                                        <div className="grid grid-cols-2 gap-2 pt-2 border-t border-slate-100">
                                            <button 
                                                onClick={() => handleApproveLeave(req.id)}
                                                className="py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-black uppercase tracking-wider flex items-center justify-center gap-1 transition"
                                            >
                                                <Check size={14} /> Approve
                                            </button>
                                            <button 
                                                onClick={() => handleRejectLeave(req.id)}
                                                className="py-1.5 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 rounded-lg text-xs font-black uppercase tracking-wider flex items-center justify-center gap-1 transition"
                                            >
                                                <X size={14} /> Decline
                                            </button>
                                        </div>
                                    ) : (
                                        <div className="text-[10px] text-slate-400 font-medium pt-1 border-t border-slate-100 flex justify-between">
                                            <span>Signed by: {req.approvedBy || 'HR Admin'}</span>
                                            <span>{req.approvedOn}</span>
                                        </div>
                                    )}
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {/* 5. PERFORMANCE APPRAISALS */}
                {subTab === 'performance' && (
                    <div className="space-y-4">
                        <div className="flex flex-col sm:flex-row justify-between items-stretch sm:items-center gap-2">
                            <div>
                                <h3 className="text-base font-black text-slate-900 flex items-center gap-2">
                                    <Award size={18} className="text-indigo-600" /> Employee Performance Scorecards
                                </h3>
                                <p className="text-xs text-slate-500">Quarterly appraisals, customer ratings, transaction targets, and KPI tracking.</p>
                            </div>
                            <button 
                                onClick={() => setIsPerformanceModalOpen(true)}
                                className="tech-button !px-3 !py-2 !text-xs flex items-center gap-1.5"
                            >
                                <Plus size={14} /> Record Performance Review
                            </button>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                            {performanceReviews.map(rev => (
                                <div key={rev.id} className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm space-y-3">
                                    <div className="flex items-start justify-between gap-2">
                                        <div>
                                            <h4 className="font-black text-slate-900 text-sm">{rev.employeeName}</h4>
                                            <div className="text-[10px] text-indigo-600 font-bold">{rev.jobTitle} • {rev.reviewPeriod}</div>
                                        </div>
                                        <div className="bg-amber-50 border border-amber-200 text-amber-800 px-2 py-1 rounded-lg text-xs font-black flex items-center gap-1">
                                            ⭐ {rev.overallRating}
                                        </div>
                                    </div>

                                    {/* Metrics Bar Breakdown */}
                                    <div className="grid grid-cols-2 gap-2 text-[11px] bg-slate-50 p-2.5 rounded-lg border border-slate-100 font-semibold">
                                        <div className="flex justify-between">
                                            <span className="text-slate-500">Punctuality:</span>
                                            <span className="text-slate-800">{rev.punctualityScore} / 5</span>
                                        </div>
                                        <div className="flex justify-between">
                                            <span className="text-slate-500">Service:</span>
                                            <span className="text-slate-800">{rev.customerServiceScore} / 5</span>
                                        </div>
                                        <div className="flex justify-between">
                                            <span className="text-slate-500">Accuracy:</span>
                                            <span className="text-slate-800">{rev.accuracyScore} / 5</span>
                                        </div>
                                        <div className="flex justify-between">
                                            <span className="text-slate-500">Teamwork:</span>
                                            <span className="text-slate-800">{rev.teamworkScore} / 5</span>
                                        </div>
                                    </div>

                                    <div className="text-xs space-y-1">
                                        <div>
                                            <span className="text-[9px] font-black uppercase tracking-wider text-emerald-700 block">Strengths</span>
                                            <p className="text-slate-700 leading-relaxed text-[11px]">{rev.strengths}</p>
                                        </div>
                                        <div className="pt-1">
                                            <span className="text-[9px] font-black uppercase tracking-wider text-indigo-700 block">Next Milestone Goals</span>
                                            <p className="text-slate-700 leading-relaxed text-[11px]">{rev.goals}</p>
                                        </div>
                                    </div>

                                    <div className="text-[10px] text-slate-400 pt-2 border-t border-slate-100 flex justify-between font-mono">
                                        <span>Evaluator: {rev.reviewer}</span>
                                        <span>{rev.date}</span>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {/* 6. HR COMPLIANCE & DOCUMENTS */}
                {subTab === 'documents' && (
                    <div className="space-y-4">
                        <div className="flex flex-col sm:flex-row justify-between items-stretch sm:items-center gap-2">
                            <div>
                                <h3 className="text-base font-black text-slate-900 flex items-center gap-2">
                                    <FileText size={18} className="text-indigo-600" /> Digital HR Vault & Compliance
                                </h3>
                                <p className="text-xs text-slate-500">Staff contracts, food hygiene certificates, code of conduct policies, and OSHA records.</p>
                            </div>
                            <button 
                                onClick={() => setIsDocModalOpen(true)}
                                className="tech-button !px-3 !py-2 !text-xs flex items-center gap-1.5"
                            >
                                <Plus size={14} /> Catalog New Document
                            </button>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                            {documents.map(doc => (
                                <div key={doc.id} className="bg-white border border-slate-200 rounded-xl p-3.5 shadow-sm space-y-2.5">
                                    <div className="flex items-start justify-between gap-2">
                                        <div className="flex items-center gap-2.5">
                                            <div className="w-9 h-9 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center shrink-0">
                                                <FileCheck size={18} />
                                            </div>
                                            <div>
                                                <h4 className="font-bold text-slate-900 text-xs line-clamp-1">{doc.title}</h4>
                                                <span className="text-[9px] font-black uppercase text-indigo-600 bg-indigo-50 px-1.5 py-0.5 rounded">
                                                    {doc.category}
                                                </span>
                                            </div>
                                        </div>

                                        <span className={`px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider ${
                                            doc.status === 'valid' ? 'bg-emerald-100 text-emerald-800' :
                                            doc.status === 'expiring_soon' ? 'bg-amber-100 text-amber-800' : 'bg-rose-100 text-rose-800'
                                        }`}>
                                            {doc.status.replace('_', ' ')}
                                        </span>
                                    </div>

                                    {doc.employeeName && (
                                        <div className="text-[11px] text-slate-600 font-medium">
                                            Assigned to: <strong className="text-slate-800">{doc.employeeName}</strong>
                                        </div>
                                    )}

                                    <div className="flex items-center justify-between text-[10px] text-slate-400 font-mono pt-2 border-t border-slate-100">
                                        <span>Size: {doc.fileSize}</span>
                                        <span>{doc.expiryDate ? `Expires: ${doc.expiryDate}` : `Uploaded: ${doc.uploadDate}`}</span>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                )}
            </div>

            {/* MODAL 1: ONBOARD / EDIT EMPLOYEE FORM */}
            {isEmployeeModalOpen && (
                <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-3 animate-fade-in">
                    <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-2xl max-h-[90vh] flex flex-col overflow-hidden">
                        <div className="px-5 py-4 border-b border-slate-200 flex justify-between items-center bg-slate-50">
                            <div>
                                <h3 className="text-base font-black text-slate-900 flex items-center gap-2">
                                    <UserPlus size={18} className="text-indigo-600" />
                                    {editingEmployee ? `Edit Employee: ${editingEmployee.fullName}` : 'Onboard New Staff Member'}
                                </h3>
                                <p className="text-xs text-slate-500">Fill in personal identity, statutory accounts (KRA, NSSF, NHIF), and compensation details.</p>
                            </div>
                            <button 
                                onClick={() => setIsEmployeeModalOpen(false)}
                                className="p-1.5 text-slate-400 hover:text-slate-700 rounded-lg"
                            >
                                ✕
                            </button>
                        </div>

                        <form onSubmit={handleSaveEmployee} className="flex-1 overflow-y-auto custom-scrollbar p-5 space-y-4">
                            {/* Section: Personal Details */}
                            <div>
                                <h4 className="text-xs font-black uppercase tracking-wider text-indigo-600 mb-2">1. Personal Identification</h4>
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                    <div>
                                        <label className="text-[10px] font-black uppercase text-slate-500 block mb-1">Full Legal Name *</label>
                                        <input required name="fullName" defaultValue={editingEmployee?.fullName} className="tech-input !text-xs !py-2 w-full" placeholder="e.g. Joy Muthoni Mwangi" />
                                    </div>
                                    <div>
                                        <label className="text-[10px] font-black uppercase text-slate-500 block mb-1">National ID / Passport No *</label>
                                        <input required name="nationalId" defaultValue={editingEmployee?.nationalId} className="tech-input !text-xs !py-2 w-full" placeholder="e.g. 31284950" />
                                    </div>
                                    <div>
                                        <label className="text-[10px] font-black uppercase text-slate-500 block mb-1">Phone Number (M-Pesa) *</label>
                                        <input required name="phone" defaultValue={editingEmployee?.phone} className="tech-input !text-xs !py-2 w-full" placeholder="+254 7..." />
                                    </div>
                                    <div>
                                        <label className="text-[10px] font-black uppercase text-slate-500 block mb-1">Official Email Address *</label>
                                        <input required type="email" name="email" defaultValue={editingEmployee?.email} className="tech-input !text-xs !py-2 w-full" placeholder="name@company.com" />
                                    </div>
                                    <div>
                                        <label className="text-[10px] font-black uppercase text-slate-500 block mb-1">Gender</label>
                                        <select name="gender" defaultValue={editingEmployee?.gender || 'Female'} className="tech-input !text-xs !py-2 w-full">
                                            <option value="Female">Female</option>
                                            <option value="Male">Male</option>
                                            <option value="Other">Other</option>
                                        </select>
                                    </div>
                                    <div>
                                        <label className="text-[10px] font-black uppercase text-slate-500 block mb-1">Date of Birth</label>
                                        <input type="date" name="dateOfBirth" defaultValue={editingEmployee?.dateOfBirth || '1995-01-01'} className="tech-input !text-xs !py-2 w-full" />
                                    </div>
                                </div>
                            </div>

                            {/* Section: Job Assignment */}
                            <div className="pt-2 border-t border-slate-100">
                                <h4 className="text-xs font-black uppercase tracking-wider text-indigo-600 mb-2">2. Department & Role Assignment</h4>
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                    <div>
                                        <label className="text-[10px] font-black uppercase text-slate-500 block mb-1">Department *</label>
                                        <select name="department" defaultValue={editingEmployee?.department || 'Sales & POS'} className="tech-input !text-xs !py-2 w-full">
                                            <option value="Sales & POS">Sales & POS</option>
                                            <option value="Inventory & Logistics">Inventory & Logistics</option>
                                            <option value="Accounts & Finance">Accounts & Finance</option>
                                            <option value="Production & Workshop">Production & Workshop</option>
                                            <option value="Administration">Administration</option>
                                            <option value="Customer Support">Customer Support</option>
                                        </select>
                                    </div>
                                    <div>
                                        <label className="text-[10px] font-black uppercase text-slate-500 block mb-1">Official Job Title *</label>
                                        <input required name="jobTitle" defaultValue={editingEmployee?.jobTitle || 'Sales Executive'} className="tech-input !text-xs !py-2 w-full" placeholder="e.g. Lead Cashier" />
                                    </div>
                                    <div>
                                        <label className="text-[10px] font-black uppercase text-slate-500 block mb-1">System Role</label>
                                        <select name="role" defaultValue={editingEmployee?.role || 'cashier'} className="tech-input !text-xs !py-2 w-full">
                                            <option value="cashier">Cashier (POS Operator)</option>
                                            <option value="supervisor">Supervisor</option>
                                            <option value="clerk">Inventory Clerk</option>
                                            <option value="technician">Technician</option>
                                            <option value="manager">Manager</option>
                                            <option value="staff">Staff / General</option>
                                        </select>
                                    </div>
                                    <div>
                                        <label className="text-[10px] font-black uppercase text-slate-500 block mb-1">Employment Type</label>
                                        <select name="employmentType" defaultValue={editingEmployee?.employmentType || 'Full-time'} className="tech-input !text-xs !py-2 w-full">
                                            <option value="Full-time">Full-time</option>
                                            <option value="Part-time">Part-time</option>
                                            <option value="Contract">Contract</option>
                                            <option value="Casual">Casual / Shift</option>
                                        </select>
                                    </div>
                                    <div className="sm:col-span-2">
                                        <label className="text-[10px] font-black uppercase text-slate-500 block mb-1">Assigned Work Station</label>
                                        <input name="workStation" defaultValue={editingEmployee?.workStation || 'Main Branch POS Terminal'} className="tech-input !text-xs !py-2 w-full" placeholder="e.g. Terminal 1 / Central Warehouse" />
                                    </div>
                                </div>
                            </div>

                            {/* Section: Statutory & Compensation */}
                            <div className="pt-2 border-t border-slate-100">
                                <h4 className="text-xs font-black uppercase tracking-wider text-indigo-600 mb-2">3. Compensation & Statutory Tax Numbers</h4>
                                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                                    <div>
                                        <label className="text-[10px] font-black uppercase text-slate-500 block mb-1">Basic Monthly Salary (KES) *</label>
                                        <input required type="number" name="basicSalary" defaultValue={editingEmployee?.basicSalary || 45000} className="tech-input !text-xs !py-2 w-full" />
                                    </div>
                                    <div>
                                        <label className="text-[10px] font-black uppercase text-slate-500 block mb-1">Housing Allowance</label>
                                        <input type="number" name="housingAllowance" defaultValue={editingEmployee?.housingAllowance || 10000} className="tech-input !text-xs !py-2 w-full" />
                                    </div>
                                    <div>
                                        <label className="text-[10px] font-black uppercase text-slate-500 block mb-1">Transport Allowance</label>
                                        <input type="number" name="transportAllowance" defaultValue={editingEmployee?.transportAllowance || 5000} className="tech-input !text-xs !py-2 w-full" />
                                    </div>
                                    <div>
                                        <label className="text-[10px] font-black uppercase text-slate-500 block mb-1">KRA PIN Number *</label>
                                        <input required name="kraPin" defaultValue={editingEmployee?.kraPin || 'A009876543Z'} className="tech-input !text-xs !py-2 w-full uppercase" />
                                    </div>
                                    <div>
                                        <label className="text-[10px] font-black uppercase text-slate-500 block mb-1">NSSF Number</label>
                                        <input name="nssfNo" defaultValue={editingEmployee?.nssfNo || 'NSSF-12345'} className="tech-input !text-xs !py-2 w-full" />
                                    </div>
                                    <div>
                                        <label className="text-[10px] font-black uppercase text-slate-500 block mb-1">NHIF / SHIF Number</label>
                                        <input name="nhifNo" defaultValue={editingEmployee?.nhifNo || 'NHIF-67890'} className="tech-input !text-xs !py-2 w-full" />
                                    </div>
                                </div>
                            </div>

                            {/* Section: Disbursement Method */}
                            <div className="pt-2 border-t border-slate-100">
                                <h4 className="text-xs font-black uppercase tracking-wider text-indigo-600 mb-2">4. Disbursal & Emergency Contact</h4>
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                    <div>
                                        <label className="text-[10px] font-black uppercase text-slate-500 block mb-1">Payment Method</label>
                                        <select name="paymentMethod" defaultValue={editingEmployee?.paymentMethod || 'M-Pesa'} className="tech-input !text-xs !py-2 w-full">
                                            <option value="M-Pesa">M-Pesa Mobile Money</option>
                                            <option value="Bank Transfer">Bank Electronic Funds Transfer</option>
                                            <option value="Cash">Cash Voucher</option>
                                        </select>
                                    </div>
                                    <div>
                                        <label className="text-[10px] font-black uppercase text-slate-500 block mb-1">Bank Name & Account No</label>
                                        <input name="bankAccountNo" defaultValue={editingEmployee?.bankAccountNo} className="tech-input !text-xs !py-2 w-full" placeholder="e.g. Equity Bank - 0123456789" />
                                    </div>
                                    <div>
                                        <label className="text-[10px] font-black uppercase text-slate-500 block mb-1">Emergency Contact Name</label>
                                        <input name="emergencyContactName" defaultValue={editingEmployee?.emergencyContactName} className="tech-input !text-xs !py-2 w-full" placeholder="Next of Kin / Relative" />
                                    </div>
                                    <div>
                                        <label className="text-[10px] font-black uppercase text-slate-500 block mb-1">Emergency Contact Phone</label>
                                        <input name="emergencyContactPhone" defaultValue={editingEmployee?.emergencyContactPhone} className="tech-input !text-xs !py-2 w-full" placeholder="+254 7..." />
                                    </div>
                                </div>
                            </div>

                            <div className="pt-4 border-t border-slate-200 flex justify-end gap-2">
                                <button 
                                    type="button" 
                                    onClick={() => setIsEmployeeModalOpen(false)}
                                    className="px-4 py-2 border border-slate-200 rounded-lg text-xs font-black uppercase tracking-wider text-slate-600 hover:bg-slate-50"
                                >
                                    Cancel
                                </button>
                                <button 
                                    type="submit"
                                    className="tech-button !px-6 !py-2 !text-xs"
                                >
                                    {editingEmployee ? 'Save Changes' : 'Complete Onboarding'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* MODAL 2: MANUAL ATTENDANCE LOG */}
            {isAttendanceModalOpen && (
                <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-3 animate-fade-in">
                    <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-md overflow-hidden">
                        <div className="px-5 py-4 border-b border-slate-200 flex justify-between items-center bg-slate-50">
                            <h3 className="text-base font-black text-slate-900 flex items-center gap-2">
                                <Clock size={18} className="text-indigo-600" /> Log Shift Attendance Record
                            </h3>
                            <button onClick={() => setIsAttendanceModalOpen(false)} className="text-slate-400">✕</button>
                        </div>
                        <form onSubmit={handleSaveAttendance} className="p-5 space-y-3">
                            <div>
                                <label className="text-[10px] font-black uppercase text-slate-500 block mb-1">Select Employee *</label>
                                <select required name="employeeId" className="tech-input !text-xs !py-2 w-full">
                                    {employees.map(e => (
                                        <option key={e.id} value={e.id}>{e.fullName} ({e.employeeNo} - {e.department})</option>
                                    ))}
                                </select>
                            </div>
                            <div className="grid grid-cols-2 gap-2">
                                <div>
                                    <label className="text-[10px] font-black uppercase text-slate-500 block mb-1">Date</label>
                                    <input type="date" name="date" defaultValue={new Date().toISOString().split('T')[0]} className="tech-input !text-xs !py-2 w-full" />
                                </div>
                                <div>
                                    <label className="text-[10px] font-black uppercase text-slate-500 block mb-1">Status</label>
                                    <select name="status" className="tech-input !text-xs !py-2 w-full">
                                        <option value="present">Present (On Time)</option>
                                        <option value="late">Late Arrival</option>
                                        <option value="half_day">Half Day Shift</option>
                                        <option value="absent">Absent</option>
                                    </select>
                                </div>
                            </div>
                            <div className="grid grid-cols-2 gap-2">
                                <div>
                                    <label className="text-[10px] font-black uppercase text-slate-500 block mb-1">Clock In Time</label>
                                    <input name="clockInTime" defaultValue="08:00 AM" className="tech-input !text-xs !py-2 w-full" />
                                </div>
                                <div>
                                    <label className="text-[10px] font-black uppercase text-slate-500 block mb-1">Clock Out Time</label>
                                    <input name="clockOutTime" defaultValue="05:00 PM" className="tech-input !text-xs !py-2 w-full" />
                                </div>
                            </div>
                            <div className="grid grid-cols-2 gap-2">
                                <div>
                                    <label className="text-[10px] font-black uppercase text-slate-500 block mb-1">Hours Worked</label>
                                    <input type="number" step="0.5" name="hoursWorked" defaultValue="8" className="tech-input !text-xs !py-2 w-full" />
                                </div>
                                <div>
                                    <label className="text-[10px] font-black uppercase text-slate-500 block mb-1">Overtime Hours</label>
                                    <input type="number" step="0.5" name="overtimeHours" defaultValue="0" className="tech-input !text-xs !py-2 w-full" />
                                </div>
                            </div>
                            <div>
                                <label className="text-[10px] font-black uppercase text-slate-500 block mb-1">Work Station</label>
                                <input name="workstation" defaultValue="Main Store POS" className="tech-input !text-xs !py-2 w-full" />
                            </div>
                            <div>
                                <label className="text-[10px] font-black uppercase text-slate-500 block mb-1">Supervisor Shift Notes</label>
                                <textarea name="notes" rows={2} placeholder="Optional notes regarding the shift..." className="tech-input !text-xs !py-2 w-full" />
                            </div>

                            <div className="pt-3 border-t border-slate-100 flex justify-end gap-2">
                                <button type="button" onClick={() => setIsAttendanceModalOpen(false)} className="px-3 py-1.5 text-xs text-slate-600">Cancel</button>
                                <button type="submit" className="tech-button !px-4 !py-2 !text-xs">Save Attendance</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* MODAL 3: LEAVE APPLICATION FORM */}
            {isLeaveModalOpen && (
                <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-3 animate-fade-in">
                    <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-md overflow-hidden">
                        <div className="px-5 py-4 border-b border-slate-200 flex justify-between items-center bg-slate-50">
                            <h3 className="text-base font-black text-slate-900 flex items-center gap-2">
                                <Calendar size={18} className="text-indigo-600" /> Apply for Staff Leave
                            </h3>
                            <button onClick={() => setIsLeaveModalOpen(false)} className="text-slate-400">✕</button>
                        </div>
                        <form onSubmit={handleApplyLeave} className="p-5 space-y-3">
                            <div>
                                <label className="text-[10px] font-black uppercase text-slate-500 block mb-1">Employee *</label>
                                <select required name="employeeId" className="tech-input !text-xs !py-2 w-full">
                                    {employees.map(e => (
                                        <option key={e.id} value={e.id}>{e.fullName} ({e.department})</option>
                                    ))}
                                </select>
                            </div>
                            <div>
                                <label className="text-[10px] font-black uppercase text-slate-500 block mb-1">Leave Type *</label>
                                <select name="leaveType" className="tech-input !text-xs !py-2 w-full">
                                    <option value="Annual Leave">Annual Leave</option>
                                    <option value="Sick Leave">Sick Leave (Medical)</option>
                                    <option value="Maternity / Paternity">Maternity / Paternity</option>
                                    <option value="Compassionate">Compassionate Leave</option>
                                    <option value="Study Leave">Study / Exam Leave</option>
                                    <option value="Unpaid Leave">Unpaid Leave</option>
                                </select>
                            </div>
                            <div className="grid grid-cols-2 gap-2">
                                <div>
                                    <label className="text-[10px] font-black uppercase text-slate-500 block mb-1">Start Date</label>
                                    <input type="date" name="startDate" defaultValue={new Date().toISOString().split('T')[0]} className="tech-input !text-xs !py-2 w-full" />
                                </div>
                                <div>
                                    <label className="text-[10px] font-black uppercase text-slate-500 block mb-1">End Date</label>
                                    <input type="date" name="endDate" defaultValue={new Date().toISOString().split('T')[0]} className="tech-input !text-xs !py-2 w-full" />
                                </div>
                            </div>
                            <div className="grid grid-cols-2 gap-2">
                                <div>
                                    <label className="text-[10px] font-black uppercase text-slate-500 block mb-1">Days Count</label>
                                    <input type="number" name="days" defaultValue="3" min="1" className="tech-input !text-xs !py-2 w-full" />
                                </div>
                                <div>
                                    <label className="text-[10px] font-black uppercase text-slate-500 block mb-1">Handover Colleague</label>
                                    <input name="handoverTo" placeholder="Colleague name" className="tech-input !text-xs !py-2 w-full" />
                                </div>
                            </div>
                            <div>
                                <label className="text-[10px] font-black uppercase text-slate-500 block mb-1">Reason for Leave *</label>
                                <textarea required name="reason" rows={3} placeholder="Provide details for leave request..." className="tech-input !text-xs !py-2 w-full" />
                            </div>

                            <div className="pt-3 border-t border-slate-100 flex justify-end gap-2">
                                <button type="button" onClick={() => setIsLeaveModalOpen(false)} className="px-3 py-1.5 text-xs text-slate-600">Cancel</button>
                                <button type="submit" className="tech-button !px-4 !py-2 !text-xs">Submit Request</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* MODAL 4: PERFORMANCE APPRAISAL FORM */}
            {isPerformanceModalOpen && (
                <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-3 animate-fade-in">
                    <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-lg max-h-[90vh] flex flex-col overflow-hidden">
                        <div className="px-5 py-4 border-b border-slate-200 flex justify-between items-center bg-slate-50">
                            <h3 className="text-base font-black text-slate-900 flex items-center gap-2">
                                <Award size={18} className="text-indigo-600" /> Record Staff Performance Appraisal
                            </h3>
                            <button onClick={() => setIsPerformanceModalOpen(false)} className="text-slate-400">✕</button>
                        </div>
                        <form onSubmit={handleSavePerformance} className="flex-1 overflow-y-auto custom-scrollbar p-5 space-y-3">
                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <label className="text-[10px] font-black uppercase text-slate-500 block mb-1">Employee *</label>
                                    <select required name="employeeId" className="tech-input !text-xs !py-2 w-full">
                                        {employees.map(e => (
                                            <option key={e.id} value={e.id}>{e.fullName}</option>
                                        ))}
                                    </select>
                                </div>
                                <div>
                                    <label className="text-[10px] font-black uppercase text-slate-500 block mb-1">Review Period *</label>
                                    <input name="reviewPeriod" defaultValue="Q3 2026" className="tech-input !text-xs !py-2 w-full" />
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <label className="text-[10px] font-black uppercase text-slate-500 block mb-1">Sales Volume (KES)</label>
                                    <input type="number" name="salesVolume" defaultValue="0" className="tech-input !text-xs !py-2 w-full" />
                                </div>
                                <div>
                                    <label className="text-[10px] font-black uppercase text-slate-500 block mb-1">Transactions Handled</label>
                                    <input type="number" name="transactionsHandled" defaultValue="150" className="tech-input !text-xs !py-2 w-full" />
                                </div>
                            </div>

                            {/* Ratings 1-5 */}
                            <div className="grid grid-cols-2 gap-3 p-3 bg-slate-50 rounded-xl border border-slate-100">
                                <div>
                                    <label className="text-[10px] font-black uppercase text-slate-500 block mb-1">Punctuality (1-5)</label>
                                    <select name="punctualityScore" defaultValue="5" className="tech-input !text-xs !py-1.5 w-full">
                                        <option value="5">5 - Exceptional</option>
                                        <option value="4">4 - Good</option>
                                        <option value="3">3 - Satisfactory</option>
                                        <option value="2">2 - Needs Improvement</option>
                                        <option value="1">1 - Unsatisfactory</option>
                                    </select>
                                </div>
                                <div>
                                    <label className="text-[10px] font-black uppercase text-slate-500 block mb-1">Customer Service (1-5)</label>
                                    <select name="customerServiceScore" defaultValue="5" className="tech-input !text-xs !py-1.5 w-full">
                                        <option value="5">5 - Exceptional</option>
                                        <option value="4">4 - Good</option>
                                        <option value="3">3 - Satisfactory</option>
                                        <option value="2">2 - Needs Improvement</option>
                                        <option value="1">1 - Unsatisfactory</option>
                                    </select>
                                </div>
                                <div>
                                    <label className="text-[10px] font-black uppercase text-slate-500 block mb-1">Accuracy / Till Balance (1-5)</label>
                                    <select name="accuracyScore" defaultValue="5" className="tech-input !text-xs !py-1.5 w-full">
                                        <option value="5">5 - Exceptional</option>
                                        <option value="4">4 - Good</option>
                                        <option value="3">3 - Satisfactory</option>
                                        <option value="2">2 - Needs Improvement</option>
                                        <option value="1">1 - Unsatisfactory</option>
                                    </select>
                                </div>
                                <div>
                                    <label className="text-[10px] font-black uppercase text-slate-500 block mb-1">Team Collaboration (1-5)</label>
                                    <select name="teamworkScore" defaultValue="4" className="tech-input !text-xs !py-1.5 w-full">
                                        <option value="5">5 - Exceptional</option>
                                        <option value="4">4 - Good</option>
                                        <option value="3">3 - Satisfactory</option>
                                        <option value="2">2 - Needs Improvement</option>
                                        <option value="1">1 - Unsatisfactory</option>
                                    </select>
                                </div>
                            </div>

                            <div>
                                <label className="text-[10px] font-black uppercase text-slate-500 block mb-1">Core Strengths & Commendations *</label>
                                <textarea required name="strengths" rows={2} defaultValue="Displays high commitment, accurate cash reconciliation, and courteous customer engagement." className="tech-input !text-xs !py-2 w-full" />
                            </div>

                            <div>
                                <label className="text-[10px] font-black uppercase text-slate-500 block mb-1">Future Goals & Growth Target</label>
                                <textarea name="goals" rows={2} defaultValue="Expand product knowledge across premium regimes and assist in training new onboarding staff." className="tech-input !text-xs !py-2 w-full" />
                            </div>

                            <div className="pt-3 border-t border-slate-100 flex justify-end gap-2">
                                <button type="button" onClick={() => setIsPerformanceModalOpen(false)} className="px-3 py-1.5 text-xs text-slate-600">Cancel</button>
                                <button type="submit" className="tech-button !px-4 !py-2 !text-xs">Record Appraisal</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* MODAL 5: DOCUMENT REGISTRATION FORM */}
            {isDocModalOpen && (
                <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-3 animate-fade-in">
                    <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-md overflow-hidden">
                        <div className="px-5 py-4 border-b border-slate-200 flex justify-between items-center bg-slate-50">
                            <h3 className="text-base font-black text-slate-900 flex items-center gap-2">
                                <FileText size={18} className="text-indigo-600" /> Catalog Compliance Document
                            </h3>
                            <button onClick={() => setIsDocModalOpen(false)} className="text-slate-400">✕</button>
                        </div>
                        <form onSubmit={handleSaveDocument} className="p-5 space-y-3">
                            <div>
                                <label className="text-[10px] font-black uppercase text-slate-500 block mb-1">Document Title *</label>
                                <input required name="title" placeholder="e.g. Sales Employment Agreement 2026" className="tech-input !text-xs !py-2 w-full" />
                            </div>
                            <div>
                                <label className="text-[10px] font-black uppercase text-slate-500 block mb-1">Category *</label>
                                <select name="category" className="tech-input !text-xs !py-2 w-full">
                                    <option value="Contract">Employment Contract</option>
                                    <option value="Policy">Company Policy / Ethics</option>
                                    <option value="ID & Compliance">ID, KRA & Compliance</option>
                                    <option value="Warning / Letter">Warning / Recommendation Letter</option>
                                    <option value="Training">Training & Certification</option>
                                </select>
                            </div>
                            <div>
                                <label className="text-[10px] font-black uppercase text-slate-500 block mb-1">Assign to Employee (Optional)</label>
                                <select name="employeeId" className="tech-input !text-xs !py-2 w-full">
                                    <option value="">— Company-Wide (All Staff) —</option>
                                    {employees.map(e => (
                                        <option key={e.id} value={e.id}>{e.fullName}</option>
                                    ))}
                                </select>
                            </div>
                            <div>
                                <label className="text-[10px] font-black uppercase text-slate-500 block mb-1">Expiration / Renewal Date (Optional)</label>
                                <input type="date" name="expiryDate" className="tech-input !text-xs !py-2 w-full" />
                            </div>

                            <div className="pt-3 border-t border-slate-100 flex justify-end gap-2">
                                <button type="button" onClick={() => setIsDocModalOpen(false)} className="px-3 py-1.5 text-xs text-slate-600">Cancel</button>
                                <button type="submit" className="tech-button !px-4 !py-2 !text-xs">Save Document</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* MODAL 6: DETAILED EMPLOYEE PROFILE CARD */}
            {selectedEmployeeProfile && (
                <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-3 animate-fade-in">
                    <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-xl max-h-[90vh] flex flex-col overflow-hidden">
                        <div className="px-5 py-4 border-b border-slate-200 flex justify-between items-center bg-slate-900 text-white">
                            <div className="flex items-center gap-3">
                                <div className="w-12 h-12 rounded-full bg-indigo-500 text-white font-black text-base flex items-center justify-center shadow-lg">
                                    {selectedEmployeeProfile.fullName.split(' ').map(n => n[0]).join('').slice(0, 2)}
                                </div>
                                <div>
                                    <h3 className="text-base font-black">{selectedEmployeeProfile.fullName}</h3>
                                    <span className="text-xs text-indigo-300 font-mono">{selectedEmployeeProfile.employeeNo} • {selectedEmployeeProfile.jobTitle}</span>
                                </div>
                            </div>
                            <button onClick={() => setSelectedEmployeeProfile(null)} className="text-slate-400 hover:text-white">✕</button>
                        </div>

                        <div className="flex-1 overflow-y-auto custom-scrollbar p-5 space-y-4 text-xs">
                            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 bg-slate-50 p-3 rounded-xl border border-slate-100">
                                <div>
                                    <span className="text-[9px] font-black uppercase text-slate-400 block">Status</span>
                                    <span className="font-bold text-slate-900 uppercase">{selectedEmployeeProfile.status}</span>
                                </div>
                                <div>
                                    <span className="text-[9px] font-black uppercase text-slate-400 block">Department</span>
                                    <span className="font-bold text-slate-900">{selectedEmployeeProfile.department}</span>
                                </div>
                                <div>
                                    <span className="text-[9px] font-black uppercase text-slate-400 block">Role</span>
                                    <span className="font-bold text-slate-900 uppercase">{selectedEmployeeProfile.role}</span>
                                </div>
                                <div>
                                    <span className="text-[9px] font-black uppercase text-slate-400 block">National ID</span>
                                    <span className="font-bold text-slate-900 font-mono">{selectedEmployeeProfile.nationalId}</span>
                                </div>
                                <div>
                                    <span className="text-[9px] font-black uppercase text-slate-400 block">KRA PIN</span>
                                    <span className="font-bold text-indigo-700 font-mono">{selectedEmployeeProfile.kraPin || '—'}</span>
                                </div>
                                <div>
                                    <span className="text-[9px] font-black uppercase text-slate-400 block">NSSF / NHIF</span>
                                    <span className="font-bold text-slate-900 font-mono">{selectedEmployeeProfile.nssfNo || '—'}</span>
                                </div>
                            </div>

                            <div>
                                <h4 className="font-black text-slate-900 mb-1.5 uppercase tracking-wider text-[11px]">Contact & Payment Channels</h4>
                                <div className="space-y-1 text-slate-700">
                                    <div>📞 Phone: <strong>{selectedEmployeeProfile.phone}</strong></div>
                                    <div>✉️ Email: <strong>{selectedEmployeeProfile.email}</strong></div>
                                    <div>💳 Payment: <strong>{selectedEmployeeProfile.paymentMethod}</strong> ({selectedEmployeeProfile.bankAccountNo || selectedEmployeeProfile.mpesaPhone || selectedEmployeeProfile.phone})</div>
                                    <div>🚨 Emergency Contact: <strong>{selectedEmployeeProfile.emergencyContactName || 'None listed'}</strong> ({selectedEmployeeProfile.emergencyContactPhone || '—'})</div>
                                </div>
                            </div>

                            <div className="pt-2 border-t border-slate-100">
                                <h4 className="font-black text-slate-900 mb-1.5 uppercase tracking-wider text-[11px]">Monthly Compensation Details</h4>
                                <div className="grid grid-cols-3 gap-2 bg-indigo-50/50 p-2.5 rounded-lg border border-indigo-100">
                                    <div>
                                        <span className="text-[9px] text-slate-500 font-bold block">Basic Salary</span>
                                        <span className="font-black text-slate-900">{formatCurrency(selectedEmployeeProfile.basicSalary)}</span>
                                    </div>
                                    <div>
                                        <span className="text-[9px] text-slate-500 font-bold block">Housing Allowance</span>
                                        <span className="font-black text-slate-900">{formatCurrency(selectedEmployeeProfile.housingAllowance || 0)}</span>
                                    </div>
                                    <div>
                                        <span className="text-[9px] text-slate-500 font-bold block">Transport Allowance</span>
                                        <span className="font-black text-slate-900">{formatCurrency(selectedEmployeeProfile.transportAllowance || 0)}</span>
                                    </div>
                                </div>
                            </div>

                            {selectedEmployeeProfile.notes && (
                                <div className="p-2.5 bg-slate-50 rounded-lg text-slate-600 italic">
                                    "{selectedEmployeeProfile.notes}"
                                </div>
                            )}
                        </div>

                        <div className="p-4 border-t border-slate-200 bg-slate-50 flex justify-end gap-2">
                            <button 
                                onClick={() => setSelectedEmployeeProfile(null)}
                                className="px-4 py-2 bg-white border border-slate-200 rounded-lg text-xs font-black uppercase text-slate-700"
                            >
                                Close
                            </button>
                            <button 
                                onClick={() => {
                                    setEditingEmployee(selectedEmployeeProfile);
                                    setSelectedEmployeeProfile(null);
                                    setIsEmployeeModalOpen(true);
                                }}
                                className="tech-button !px-4 !py-2 !text-xs"
                            >
                                Edit Record
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* MODAL 7: OFFICIAL STATUTORY PAYSLIP PREVIEW & PRINT MODAL */}
            {activePayslip && (
                <div className="fixed inset-0 z-50 bg-slate-900/70 backdrop-blur-sm flex items-center justify-center p-3 animate-fade-in">
                    <div className="bg-white rounded-2xl shadow-2xl border border-slate-300 w-full max-w-xl max-h-[95vh] flex flex-col overflow-hidden">
                        <div className="px-5 py-3 border-b border-slate-200 flex justify-between items-center bg-slate-900 text-white shrink-0">
                            <div className="flex items-center gap-2">
                                <Printer size={16} className="text-indigo-400" />
                                <span className="font-black text-sm uppercase tracking-wider">Official Payslip Document</span>
                            </div>
                            <div className="flex items-center gap-2">
                                <button 
                                    onClick={() => window.print()}
                                    className="tech-button !px-2.5 !py-1 !text-[11px] flex items-center gap-1"
                                >
                                    <Printer size={12} /> Print
                                </button>
                                <button onClick={() => setActivePayslip(null)} className="text-slate-400 hover:text-white p-1">✕</button>
                            </div>
                        </div>

                        {/* Payslip Document Body */}
                        <div className="flex-1 overflow-y-auto custom-scrollbar p-6 space-y-4 bg-white text-slate-900">
                            {/* Company Letterhead */}
                            <div className="border-b-2 border-slate-900 pb-3 flex justify-between items-start">
                                <div>
                                    <h2 className="text-lg font-black uppercase tracking-tight text-slate-900">PRIMEAXIS GLOBAL TRADING</h2>
                                    <p className="text-[10px] text-slate-500 uppercase font-bold">East Africa Regional Operations • P.O. Box 48291, Nairobi, Kenya</p>
                                    <p className="text-[10px] text-slate-500 font-mono">Tax Pin: P051928341M • VAT Reg: 0293849182</p>
                                </div>
                                <div className="text-right">
                                    <div className="bg-slate-900 text-white px-2 py-0.5 rounded text-[10px] font-black uppercase tracking-widest inline-block">
                                        OFFICIAL PAYSLIP
                                    </div>
                                    <div className="font-mono font-bold text-xs mt-1">{activePayslip.slipNo}</div>
                                    <div className="text-[10px] text-slate-500">{activePayslip.periodMonth} {activePayslip.periodYear}</div>
                                </div>
                            </div>

                            {/* Employee Metadata */}
                            <div className="grid grid-cols-2 gap-2 bg-slate-50 p-3 rounded-lg border border-slate-200 text-xs">
                                <div>
                                    <span className="text-slate-500 font-bold block text-[10px]">EMPLOYEE NAME</span>
                                    <strong className="text-slate-900 text-sm">{activePayslip.employeeName}</strong>
                                    <span className="block text-slate-500 text-[10px] mt-0.5">{activePayslip.jobTitle} ({activePayslip.department})</span>
                                </div>
                                <div className="space-y-0.5 text-right font-mono text-[11px]">
                                    <div>Staff ID: <strong>{activePayslip.employeeNo}</strong></div>
                                    <div>KRA PIN: <strong>{activePayslip.kraPin || 'A009876543Z'}</strong></div>
                                    <div>NSSF No: <strong>{activePayslip.nssfNo || 'NSSF-001'}</strong></div>
                                    <div>NHIF No: <strong>{activePayslip.nhifNo || 'NHIF-001'}</strong></div>
                                </div>
                            </div>

                            {/* Earnings & Allowances */}
                            <div>
                                <h4 className="text-[11px] font-black uppercase tracking-wider text-slate-700 bg-slate-100 p-1.5 rounded">
                                    A. Earnings & Allowances
                                </h4>
                                <div className="divide-y divide-slate-100 text-xs mt-1">
                                    <div className="flex justify-between py-1.5">
                                        <span>Basic Monthly Salary</span>
                                        <span className="font-bold">{formatCurrency(activePayslip.basicSalary)}</span>
                                    </div>
                                    {activePayslip.housingAllowance > 0 && (
                                        <div className="flex justify-between py-1.5">
                                            <span>Housing Allowance</span>
                                            <span className="font-bold">{formatCurrency(activePayslip.housingAllowance)}</span>
                                        </div>
                                    )}
                                    {activePayslip.transportAllowance > 0 && (
                                        <div className="flex justify-between py-1.5">
                                            <span>Transport / Commuter Allowance</span>
                                            <span className="font-bold">{formatCurrency(activePayslip.transportAllowance)}</span>
                                        </div>
                                    )}
                                    {activePayslip.overtimePay > 0 && (
                                        <div className="flex justify-between py-1.5">
                                            <span>Overtime Hours Compensatory Pay</span>
                                            <span className="font-bold">{formatCurrency(activePayslip.overtimePay)}</span>
                                        </div>
                                    )}
                                    {activePayslip.commissionPay > 0 && (
                                        <div className="flex justify-between py-1.5">
                                            <span>Sales Performance Incentive / Commission</span>
                                            <span className="font-bold text-indigo-600">{formatCurrency(activePayslip.commissionPay)}</span>
                                        </div>
                                    )}
                                    <div className="flex justify-between py-2 border-t-2 border-slate-900 font-black text-sm">
                                        <span>GROSS EARNINGS</span>
                                        <span className="text-slate-900">{formatCurrency(activePayslip.grossPay)}</span>
                                    </div>
                                </div>
                            </div>

                            {/* Statutory Deductions */}
                            <div>
                                <h4 className="text-[11px] font-black uppercase tracking-wider text-slate-700 bg-slate-100 p-1.5 rounded">
                                    B. Statutory Deductions & Taxes
                                </h4>
                                <div className="divide-y divide-slate-100 text-xs mt-1">
                                    <div className="flex justify-between py-1.5">
                                        <span>KRA P.A.Y.E Income Tax (Net after Relief)</span>
                                        <span className="font-bold text-rose-600">-{formatCurrency(activePayslip.payeTax)}</span>
                                    </div>
                                    <div className="flex justify-between py-1.5">
                                        <span>NSSF Pension Contribution (Tier 1 & 2)</span>
                                        <span className="font-bold text-rose-600">-{formatCurrency(activePayslip.nssfDeduction)}</span>
                                    </div>
                                    <div className="flex justify-between py-1.5">
                                        <span>NHIF / SHIF Medical Insurance</span>
                                        <span className="font-bold text-rose-600">-{formatCurrency(activePayslip.nhifDeduction)}</span>
                                    </div>
                                    <div className="flex justify-between py-1.5">
                                        <span>Affordable Housing Levy (1.5% Gross)</span>
                                        <span className="font-bold text-rose-600">-{formatCurrency(activePayslip.housingLevy)}</span>
                                    </div>
                                    <div className="flex justify-between py-2 border-t-2 border-slate-900 font-black text-sm text-rose-700">
                                        <span>TOTAL DEDUCTIONS</span>
                                        <span>-{formatCurrency(activePayslip.totalDeductions)}</span>
                                    </div>
                                </div>
                            </div>

                            {/* NET PAY BOX */}
                            <div className="bg-indigo-50 border-2 border-indigo-600 p-4 rounded-xl flex justify-between items-center">
                                <div>
                                    <span className="text-[10px] font-black uppercase tracking-widest text-indigo-700 block">
                                        NET TAKE-HOME REMITTANCE
                                    </span>
                                    <span className="text-xs text-slate-500">Method: {activePayslip.paymentMethod} {activePayslip.paymentReference ? `(${activePayslip.paymentReference})` : ''}</span>
                                </div>
                                <div className="text-2xl font-black text-indigo-700">
                                    {formatCurrency(activePayslip.netPay)}
                                </div>
                            </div>

                            {/* Signatures */}
                            <div className="pt-6 grid grid-cols-2 gap-6 text-[10px] border-t border-slate-200">
                                <div>
                                    <div className="border-b border-slate-400 pb-4">
                                        <span className="font-bold uppercase">Prepared by: HR & Payroll Lead</span>
                                    </div>
                                    <span className="text-slate-400 mt-1 block">Certified accurate against biometric logs</span>
                                </div>
                                <div>
                                    <div className="border-b border-slate-400 pb-4">
                                        <span className="font-bold uppercase">Employee Acknowledgment</span>
                                    </div>
                                    <span className="text-slate-400 mt-1 block">Received & Accepted</span>
                                </div>
                            </div>
                        </div>

                        <div className="p-3 bg-slate-50 border-t border-slate-200 flex justify-between items-center">
                            <span className="text-[10px] text-slate-400 font-mono">
                                Security Hash: PA-PAY-{activePayslip.id}-SEC
                            </span>
                            <div className="flex items-center gap-2">
                                {activePayslip.paymentStatus !== 'paid' && (
                                    <button 
                                        onClick={() => handleMarkSlipPaid(activePayslip)}
                                        className="tech-button !px-3 !py-1.5 !text-xs !bg-emerald-600"
                                    >
                                        Mark as Disbursed
                                    </button>
                                )}
                                <button 
                                    onClick={() => setActivePayslip(null)}
                                    className="px-3 py-1.5 border border-slate-200 rounded-lg text-xs font-black uppercase text-slate-600"
                                >
                                    Done
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};
