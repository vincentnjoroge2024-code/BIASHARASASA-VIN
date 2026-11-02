import { 
    Employee, AttendanceRecord, PayrollSlip, LeaveRequest, PerformanceReview, HRDocument 
} from '../types';

const STORAGE_KEYS = {
    EMPLOYEES: 'biashara_hr_employees',
    ATTENDANCE: 'biashara_hr_attendance',
    PAYROLL: 'biashara_hr_payroll',
    LEAVE: 'biashara_hr_leave',
    PERFORMANCE: 'biashara_hr_performance',
    DOCUMENTS: 'biashara_hr_documents',
};

// Initial Seed Data for Demo & Real usage
const INITIAL_EMPLOYEES: Employee[] = [
    {
        id: 101,
        employeeNo: 'EMP-001',
        fullName: 'Wanjiku Kamau',
        email: 'wanjiku.kamau@primeaxis.co.ke',
        phone: '+254 712 345 678',
        nationalId: '29876543',
        gender: 'Female',
        dateOfBirth: '1992-04-15',
        residence: 'Nairobi, Westlands',
        kraPin: 'A009876543Z',
        nssfNo: 'NSSF-782194',
        nhifNo: 'NHIF-562910',
        department: 'Sales & POS',
        jobTitle: 'Senior Store Cashier & Team Lead',
        role: 'cashier',
        status: 'active',
        hireDate: '2023-01-10',
        employmentType: 'Full-time',
        workStation: 'Terminal Alpha - Main Hall',
        basicSalary: 48000,
        housingAllowance: 12000,
        transportAllowance: 5000,
        commissionRate: 1.5,
        paymentMethod: 'M-Pesa',
        mpesaPhone: '+254 712 345 678',
        emergencyContactName: 'David Kamau (Spouse)',
        emergencyContactPhone: '+254 722 987 654',
        notes: 'Top performing cashier. Certified Primeaxis POS terminal operator.',
        annualLeaveEntitlement: 21,
        annualLeaveTaken: 5
    },
    {
        id: 102,
        employeeNo: 'EMP-002',
        fullName: 'Brian Omondi',
        email: 'brian.omondi@primeaxis.co.ke',
        phone: '+254 723 456 789',
        nationalId: '31245678',
        gender: 'Male',
        dateOfBirth: '1989-11-20',
        residence: 'Nairobi, South B',
        kraPin: 'P051239841K',
        nssfNo: 'NSSF-441923',
        nhifNo: 'NHIF-883102',
        department: 'Inventory & Logistics',
        jobTitle: 'Warehouse & Dispatch Supervisor',
        role: 'supervisor',
        status: 'active',
        hireDate: '2022-06-01',
        employmentType: 'Full-time',
        workStation: 'Central Depot - Bay 3',
        basicSalary: 65000,
        housingAllowance: 15000,
        transportAllowance: 8000,
        commissionRate: 0,
        paymentMethod: 'Bank Transfer',
        bankName: 'Equity Bank',
        bankAccountNo: '0180293849102',
        emergencyContactName: 'Grace Omondi (Sister)',
        emergencyContactPhone: '+254 733 112 233',
        notes: 'Oversees barcode scans, incoming supplier freight, and stock reconciliation.',
        annualLeaveEntitlement: 21,
        annualLeaveTaken: 12
    },
    {
        id: 103,
        employeeNo: 'EMP-003',
        fullName: 'Fatuma Hassan',
        email: 'fatuma.hassan@primeaxis.co.ke',
        phone: '+254 733 998 877',
        nationalId: '33456789',
        gender: 'Female',
        dateOfBirth: '1995-08-05',
        residence: 'Mombasa / Nyali',
        kraPin: 'A010992384M',
        nssfNo: 'NSSF-902184',
        nhifNo: 'NHIF-341902',
        department: 'Accounts & Finance',
        jobTitle: 'Junior Financial Accountant & Tax Clerk',
        role: 'clerk',
        status: 'active',
        hireDate: '2023-09-15',
        employmentType: 'Full-time',
        workStation: 'Finance Office - Suite 4',
        basicSalary: 55000,
        housingAllowance: 10000,
        transportAllowance: 6000,
        commissionRate: 0,
        paymentMethod: 'Bank Transfer',
        bankName: 'KCB Bank',
        bankAccountNo: '1209384756',
        emergencyContactName: 'Hassan Omar (Father)',
        emergencyContactPhone: '+254 721 556 677',
        notes: 'Handles ETR v4 reconciliations, VAT filings, and ledger postings.',
        annualLeaveEntitlement: 21,
        annualLeaveTaken: 2
    },
    {
        id: 104,
        employeeNo: 'EMP-004',
        fullName: 'Joseph Mutua',
        email: 'joseph.mutua@primeaxis.co.ke',
        phone: '+254 701 223 344',
        nationalId: '27654321',
        gender: 'Male',
        dateOfBirth: '1987-03-12',
        residence: 'Machakos / Athi River',
        kraPin: 'P022391048L',
        nssfNo: 'NSSF-619283',
        nhifNo: 'NHIF-772910',
        department: 'Production & Workshop',
        jobTitle: 'Master Processing Technician',
        role: 'technician',
        status: 'active',
        hireDate: '2021-11-01',
        employmentType: 'Full-time',
        workStation: 'Production Line #2',
        basicSalary: 52000,
        housingAllowance: 12000,
        transportAllowance: 7000,
        commissionRate: 0,
        paymentMethod: 'M-Pesa',
        mpesaPhone: '+254 701 223 344',
        emergencyContactName: 'Mercy Mutua (Wife)',
        emergencyContactPhone: '+254 711 445 566',
        notes: 'Responsible for batch manufacturing, recipe QA, and heavy machinery maintenance.',
        annualLeaveEntitlement: 21,
        annualLeaveTaken: 18
    },
    {
        id: 105,
        employeeNo: 'EMP-005',
        fullName: 'Amina Cherono',
        email: 'amina.cherono@primeaxis.co.ke',
        phone: '+254 725 667 788',
        nationalId: '35123456',
        gender: 'Female',
        dateOfBirth: '1998-02-14',
        residence: 'Eldoret / Annex',
        kraPin: 'A014552918Q',
        nssfNo: 'NSSF-112233',
        nhifNo: 'NHIF-445566',
        department: 'Customer Support',
        jobTitle: 'Client Experience & POS Helpdesk Officer',
        role: 'staff',
        status: 'on_leave',
        hireDate: '2024-02-01',
        employmentType: 'Full-time',
        workStation: 'Support Center - Desk 12',
        basicSalary: 42000,
        housingAllowance: 8000,
        transportAllowance: 4000,
        commissionRate: 0.5,
        paymentMethod: 'M-Pesa',
        mpesaPhone: '+254 725 667 788',
        emergencyContactName: 'Ezekiel Cherono (Brother)',
        emergencyContactPhone: '+254 714 889 900',
        notes: 'Currently on approved study leave until end of month.',
        annualLeaveEntitlement: 21,
        annualLeaveTaken: 8
    }
];

const getTodayDateStr = () => new Date().toISOString().split('T')[0];

const INITIAL_ATTENDANCE: AttendanceRecord[] = [
    {
        id: 1,
        employeeId: 101,
        employeeName: 'Wanjiku Kamau',
        date: getTodayDateStr(),
        clockInTime: '07:48 AM',
        clockOutTime: '04:30 PM',
        shift: 'Full Day (08:00-17:00)',
        workstation: 'Terminal Alpha - Main Hall',
        hoursWorked: 8.5,
        overtimeHours: 0.5,
        status: 'present',
        notes: 'Opened cash register on time. Processed 84 transactions.'
    },
    {
        id: 2,
        employeeId: 102,
        employeeName: 'Brian Omondi',
        date: getTodayDateStr(),
        clockInTime: '07:30 AM',
        shift: 'Morning (07:00-15:00)',
        workstation: 'Central Depot - Bay 3',
        hoursWorked: 7.5,
        overtimeHours: 1.0,
        status: 'present',
        notes: 'Supervised morning supplier delivery dispatch.'
    },
    {
        id: 3,
        employeeId: 103,
        employeeName: 'Fatuma Hassan',
        date: getTodayDateStr(),
        clockInTime: '08:22 AM',
        shift: 'Full Day (08:00-17:00)',
        workstation: 'Finance Office - Suite 4',
        hoursWorked: 7.2,
        overtimeHours: 0,
        status: 'late',
        notes: 'Delayed by traffic on Mombasa Road. Informed supervisor.'
    },
    {
        id: 4,
        employeeId: 104,
        employeeName: 'Joseph Mutua',
        date: getTodayDateStr(),
        clockInTime: '07:00 AM',
        clockOutTime: '03:15 PM',
        shift: 'Morning (07:00-15:00)',
        workstation: 'Production Line #2',
        hoursWorked: 8.0,
        overtimeHours: 0.25,
        status: 'present',
        notes: 'Shift completed with 100% batch recipe quota.'
    },
    {
        id: 5,
        employeeId: 105,
        employeeName: 'Amina Cherono',
        date: getTodayDateStr(),
        clockInTime: '-',
        shift: 'Full Day (08:00-17:00)',
        workstation: 'Support Center - Desk 12',
        hoursWorked: 0,
        overtimeHours: 0,
        status: 'on_leave',
        notes: 'Approved Study Leave'
    }
];

// Helper to calculate East Africa (Kenya/statutory) payroll breakdown
export function calculatePayslip(
    basicSalary: number, 
    housing: number = 0, 
    transport: number = 0, 
    overtime: number = 0, 
    commission: number = 0
) {
    const grossPay = basicSalary + housing + transport + overtime + commission;
    
    // NSSF Tier 1 & Tier 2 (approx 1,080 - 2,160 KES statutory)
    const nssfDeduction = Math.min(Math.round(grossPay * 0.06), 2160);
    
    // NHIF (Sliding scale standard 500 - 1,700 KES)
    let nhifDeduction = 500;
    if (grossPay > 100000) nhifDeduction = 1700;
    else if (grossPay > 50000) nhifDeduction = 1200;
    else if (grossPay > 30000) nhifDeduction = 950;
    else if (grossPay > 20000) nhifDeduction = 750;

    // Housing Levy (1.5% of Gross Pay)
    const housingLevy = Math.round(grossPay * 0.015);

    // PAYE bracket calculation with Personal Relief (KES 2,400 per month)
    const taxablePay = Math.max(0, grossPay - nssfDeduction);
    let payeRaw = 0;
    if (taxablePay <= 24000) {
        payeRaw = taxablePay * 0.10;
    } else if (taxablePay <= 32333) {
        payeRaw = (24000 * 0.10) + ((taxablePay - 24000) * 0.25);
    } else if (taxablePay <= 500000) {
        payeRaw = (24000 * 0.10) + (8333 * 0.25) + ((taxablePay - 32333) * 0.30);
    } else {
        payeRaw = (24000 * 0.10) + (8333 * 0.25) + (467667 * 0.30) + ((taxablePay - 500000) * 0.35);
    }
    const personalRelief = 2400;
    const payeTax = Math.max(0, Math.round(payeRaw - personalRelief));

    const otherDeductions = 0;
    const totalDeductions = payeTax + nssfDeduction + nhifDeduction + housingLevy + otherDeductions;
    const netPay = Math.max(0, grossPay - totalDeductions);

    return {
        grossPay,
        nssfDeduction,
        nhifDeduction,
        housingLevy,
        payeTax,
        otherDeductions,
        totalDeductions,
        netPay
    };
}

const INITIAL_PAYROLL: PayrollSlip[] = INITIAL_EMPLOYEES.map((emp, i) => {
    const housing = emp.housingAllowance || 0;
    const transport = emp.transportAllowance || 0;
    const overtime = i === 1 ? 3500 : (i === 3 ? 2800 : 0);
    const commission = i === 0 ? 6400 : 0;
    const calc = calculatePayslip(emp.basicSalary, housing, transport, overtime, commission);

    return {
        id: 200 + i,
        slipNo: `PAY-2026-${(101 + i).toString()}`,
        employeeId: emp.id,
        employeeName: emp.fullName,
        employeeNo: emp.employeeNo,
        department: emp.department,
        jobTitle: emp.jobTitle,
        kraPin: emp.kraPin,
        nssfNo: emp.nssfNo,
        nhifNo: emp.nhifNo,
        periodMonth: 'September',
        periodYear: 2026,
        basicSalary: emp.basicSalary,
        housingAllowance: housing,
        transportAllowance: transport,
        overtimePay: overtime,
        commissionPay: commission,
        grossPay: calc.grossPay,
        payeTax: calc.payeTax,
        nssfDeduction: calc.nssfDeduction,
        nhifDeduction: calc.nhifDeduction,
        housingLevy: calc.housingLevy,
        otherDeductions: 0,
        totalDeductions: calc.totalDeductions,
        netPay: calc.netPay,
        paymentStatus: i < 3 ? 'paid' : 'approved',
        paymentDate: i < 3 ? '2026-09-05' : undefined,
        paymentReference: i < 3 ? `MPESA-B2C-${892019 + i}` : undefined,
        paymentMethod: emp.paymentMethod,
        currency: 'KES'
    };
});

const INITIAL_LEAVE_REQUESTS: LeaveRequest[] = [
    {
        id: 301,
        employeeId: 105,
        employeeName: 'Amina Cherono',
        department: 'Customer Support',
        leaveType: 'Study Leave',
        startDate: '2026-09-10',
        endDate: '2026-09-25',
        days: 15,
        reason: 'Final examinations for Certified Professional Customer Relations course.',
        handoverTo: 'Wanjiku Kamau',
        status: 'approved',
        appliedOn: '2026-08-28',
        approvedBy: 'HR Manager',
        approvedOn: '2026-08-30',
        managerNotes: 'Approved. Exams schedule verified.'
    },
    {
        id: 302,
        employeeId: 102,
        employeeName: 'Brian Omondi',
        department: 'Inventory & Logistics',
        leaveType: 'Annual Leave',
        startDate: '2026-10-01',
        endDate: '2026-10-07',
        days: 7,
        reason: 'Family holiday and personal rest.',
        handoverTo: 'Joseph Mutua',
        status: 'pending',
        appliedOn: '2026-09-14',
        managerNotes: 'Awaiting shift coverage confirmation from logistics lead.'
    },
    {
        id: 303,
        employeeId: 101,
        employeeName: 'Wanjiku Kamau',
        department: 'Sales & POS',
        leaveType: 'Sick Leave',
        startDate: '2026-08-12',
        endDate: '2026-08-14',
        days: 3,
        reason: 'Outpatient treatment for acute tonsillitis.',
        handoverTo: 'Brian Omondi',
        status: 'approved',
        appliedOn: '2026-08-11',
        approvedBy: 'Admin Supervisor',
        approvedOn: '2026-08-11',
        managerNotes: 'Medical certificate on file.'
    }
];

const INITIAL_PERFORMANCE: PerformanceReview[] = [
    {
        id: 401,
        employeeId: 101,
        employeeName: 'Wanjiku Kamau',
        jobTitle: 'Senior Store Cashier & Team Lead',
        reviewPeriod: 'Q3 2026',
        salesVolume: 2450000,
        transactionsHandled: 840,
        punctualityScore: 5,
        customerServiceScore: 5,
        accuracyScore: 5,
        teamworkScore: 4,
        overallRating: 4.8,
        strengths: 'Outstanding speed at POS checkout, zero till cash discrepancies, handles busy peak hours with remarkable calm.',
        areasForImprovement: 'Could delegate barcode restocking tasks more effectively to junior clerks.',
        goals: 'Train 2 newly onboarded cashiers and achieve 99.8% customer satisfaction score.',
        reviewer: 'Operations Director',
        date: '2026-09-01'
    },
    {
        id: 402,
        employeeId: 102,
        employeeName: 'Brian Omondi',
        jobTitle: 'Warehouse & Dispatch Supervisor',
        reviewPeriod: 'Q3 2026',
        salesVolume: 0,
        transactionsHandled: 420,
        punctualityScore: 5,
        customerServiceScore: 4,
        accuracyScore: 4,
        teamworkScore: 5,
        overallRating: 4.5,
        strengths: 'Excellent warehouse space optimization and swift supplier turnaround times.',
        areasForImprovement: 'Needs to ensure electronic GRN receipts are uploaded within 2 hours of arrival.',
        goals: 'Reduce dispatch waiting times by 15% and implement batch barcode QR tracking.',
        reviewer: 'Logistics Head',
        date: '2026-09-02'
    },
    {
        id: 403,
        employeeId: 104,
        employeeName: 'Joseph Mutua',
        jobTitle: 'Master Processing Technician',
        reviewPeriod: 'Q3 2026',
        salesVolume: 0,
        transactionsHandled: 310,
        punctualityScore: 4,
        customerServiceScore: 4,
        accuracyScore: 5,
        teamworkScore: 4,
        overallRating: 4.3,
        strengths: 'Exceptional attention to recipe formulation precision and zero raw material wastage.',
        areasForImprovement: 'Daily maintenance checklists need prompt digital signoff in system.',
        goals: 'Complete preventative overhaul on Line 2 without any downtime.',
        reviewer: 'Plant Engineer',
        date: '2026-09-03'
    }
];

const INITIAL_DOCUMENTS: HRDocument[] = [
    {
        id: 501,
        title: 'Primeaxis Employee Code of Conduct & Ethics',
        category: 'Policy',
        fileSize: '1.4 MB',
        uploadDate: '2026-01-15',
        status: 'valid'
    },
    {
        id: 502,
        title: 'Standard Employment Contract - Sales Cashier (Wanjiku Kamau)',
        category: 'Contract',
        employeeId: 101,
        employeeName: 'Wanjiku Kamau',
        fileSize: '420 KB',
        uploadDate: '2023-01-10',
        status: 'valid'
    },
    {
        id: 503,
        title: 'Statutory OSHA & Fire Safety Certification 2026',
        category: 'ID & Compliance',
        fileSize: '850 KB',
        uploadDate: '2026-02-01',
        expiryDate: '2027-02-01',
        status: 'valid'
    },
    {
        id: 504,
        title: 'Food Handling & Hygiene Certificate (Joseph Mutua)',
        category: 'ID & Compliance',
        employeeId: 104,
        employeeName: 'Joseph Mutua',
        fileSize: '310 KB',
        uploadDate: '2025-10-15',
        expiryDate: '2026-10-15',
        status: 'expiring_soon'
    },
    {
        id: 505,
        title: 'POS Terminal V4 Operations Manual & Best Practices',
        category: 'Training',
        fileSize: '2.8 MB',
        uploadDate: '2026-05-10',
        status: 'valid'
    }
];

// Helper to load or initialize from localStorage
function loadFromStorage<T>(key: string, initial: T): T {
    if (typeof window === 'undefined') return initial;
    try {
        const item = localStorage.getItem(key);
        if (item) {
            return JSON.parse(item);
        }
    } catch (e) {
        console.warn(`Failed to read from localStorage ${key}:`, e);
    }
    try {
        localStorage.setItem(key, JSON.stringify(initial));
    } catch (e) {
        // ignore
    }
    return initial;
}

function saveToStorage<T>(key: string, data: T): void {
    if (typeof window === 'undefined') return;
    try {
        localStorage.setItem(key, JSON.stringify(data));
    } catch (e) {
        console.warn(`Failed to save to localStorage ${key}:`, e);
    }
}

export const hrService = {
    // Employees
    getEmployees(): Employee[] {
        return loadFromStorage<Employee[]>(STORAGE_KEYS.EMPLOYEES, INITIAL_EMPLOYEES);
    },
    saveEmployee(employee: Partial<Employee>): Employee {
        const list = this.getEmployees();
        if (employee.id) {
            const index = list.findIndex(e => e.id === employee.id);
            if (index !== -1) {
                list[index] = { ...list[index], ...employee } as Employee;
                saveToStorage(STORAGE_KEYS.EMPLOYEES, list);
                return list[index];
            }
        }
        const newId = Date.now();
        const empCode = `EMP-${(list.length + 1).toString().padStart(3, '0')}`;
        const newEmp: Employee = {
            id: newId,
            employeeNo: employee.employeeNo || empCode,
            fullName: employee.fullName || 'New Staff Member',
            email: employee.email || `staff${newId}@primeaxis.co.ke`,
            phone: employee.phone || '+254 700 000 000',
            nationalId: employee.nationalId || '00000000',
            gender: employee.gender || 'Female',
            dateOfBirth: employee.dateOfBirth || '1995-01-01',
            residence: employee.residence || 'Nairobi',
            kraPin: employee.kraPin || 'A000000000Z',
            nssfNo: employee.nssfNo || 'NSSF-0000',
            nhifNo: employee.nhifNo || 'NHIF-0000',
            department: employee.department || 'Sales & POS',
            jobTitle: employee.jobTitle || 'POS Attendant',
            role: employee.role || 'cashier',
            status: employee.status || 'active',
            hireDate: employee.hireDate || getTodayDateStr(),
            employmentType: employee.employmentType || 'Full-time',
            workStation: employee.workStation || 'Main Branch',
            basicSalary: Number(employee.basicSalary) || 40000,
            housingAllowance: Number(employee.housingAllowance) || 0,
            transportAllowance: Number(employee.transportAllowance) || 0,
            commissionRate: Number(employee.commissionRate) || 0,
            paymentMethod: employee.paymentMethod || 'M-Pesa',
            bankName: employee.bankName,
            bankAccountNo: employee.bankAccountNo,
            mpesaPhone: employee.mpesaPhone || employee.phone,
            emergencyContactName: employee.emergencyContactName,
            emergencyContactPhone: employee.emergencyContactPhone,
            notes: employee.notes,
            annualLeaveEntitlement: 21,
            annualLeaveTaken: 0
        };
        list.unshift(newEmp);
        saveToStorage(STORAGE_KEYS.EMPLOYEES, list);
        return newEmp;
    },
    deleteEmployee(id: number): void {
        const list = this.getEmployees().filter(e => e.id !== id);
        saveToStorage(STORAGE_KEYS.EMPLOYEES, list);
    },

    // Attendance
    getAttendance(): AttendanceRecord[] {
        return loadFromStorage<AttendanceRecord[]>(STORAGE_KEYS.ATTENDANCE, INITIAL_ATTENDANCE);
    },
    saveAttendance(record: Partial<AttendanceRecord>): AttendanceRecord {
        const list = this.getAttendance();
        if (record.id) {
            const index = list.findIndex(a => a.id === record.id);
            if (index !== -1) {
                list[index] = { ...list[index], ...record } as AttendanceRecord;
                saveToStorage(STORAGE_KEYS.ATTENDANCE, list);
                return list[index];
            }
        }
        const newRecord: AttendanceRecord = {
            id: Date.now(),
            employeeId: record.employeeId || 101,
            employeeName: record.employeeName || 'Staff Member',
            date: record.date || getTodayDateStr(),
            clockInTime: record.clockInTime || new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
            clockOutTime: record.clockOutTime,
            shift: record.shift || 'Full Day (08:00-17:00)',
            workstation: record.workstation || 'Terminal 1',
            hoursWorked: record.hoursWorked || 8,
            overtimeHours: record.overtimeHours || 0,
            status: record.status || 'present',
            notes: record.notes
        };
        list.unshift(newRecord);
        saveToStorage(STORAGE_KEYS.ATTENDANCE, list);
        return newRecord;
    },

    // Payroll
    getPayroll(): PayrollSlip[] {
        return loadFromStorage<PayrollSlip[]>(STORAGE_KEYS.PAYROLL, INITIAL_PAYROLL);
    },
    savePayrollSlip(slip: PayrollSlip): void {
        const list = this.getPayroll();
        const index = list.findIndex(p => p.id === slip.id);
        if (index !== -1) {
            list[index] = slip;
        } else {
            list.unshift(slip);
        }
        saveToStorage(STORAGE_KEYS.PAYROLL, list);
    },
    generateMonthlyPayroll(month: string, year: number): PayrollSlip[] {
        const employees = this.getEmployees().filter(e => e.status !== 'terminated');
        const existing = this.getPayroll().filter(p => p.periodMonth === month && p.periodYear === year);
        const existingEmpIds = new Set(existing.map(p => p.employeeId));

        const generated: PayrollSlip[] = [];
        employees.forEach(emp => {
            if (!existingEmpIds.has(emp.id)) {
                const housing = emp.housingAllowance || 0;
                const transport = emp.transportAllowance || 0;
                const overtime = 0;
                const commission = 0;
                const calc = calculatePayslip(emp.basicSalary, housing, transport, overtime, commission);

                const newSlip: PayrollSlip = {
                    id: Date.now() + Math.floor(Math.random() * 1000),
                    slipNo: `PAY-${year}-${emp.employeeNo.replace('EMP-', '')}-${Math.floor(100 + Math.random() * 900)}`,
                    employeeId: emp.id,
                    employeeName: emp.fullName,
                    employeeNo: emp.employeeNo,
                    department: emp.department,
                    jobTitle: emp.jobTitle,
                    kraPin: emp.kraPin,
                    nssfNo: emp.nssfNo,
                    nhifNo: emp.nhifNo,
                    periodMonth: month,
                    periodYear: year,
                    basicSalary: emp.basicSalary,
                    housingAllowance: housing,
                    transportAllowance: transport,
                    overtimePay: overtime,
                    commissionPay: commission,
                    grossPay: calc.grossPay,
                    payeTax: calc.payeTax,
                    nssfDeduction: calc.nssfDeduction,
                    nhifDeduction: calc.nhifDeduction,
                    housingLevy: calc.housingLevy,
                    otherDeductions: 0,
                    totalDeductions: calc.totalDeductions,
                    netPay: calc.netPay,
                    paymentStatus: 'draft',
                    paymentMethod: emp.paymentMethod,
                    currency: 'KES'
                };
                generated.push(newSlip);
            }
        });

        const all = [...generated, ...this.getPayroll()];
        saveToStorage(STORAGE_KEYS.PAYROLL, all);
        return all;
    },

    // Leave
    getLeaveRequests(): LeaveRequest[] {
        return loadFromStorage<LeaveRequest[]>(STORAGE_KEYS.LEAVE, INITIAL_LEAVE_REQUESTS);
    },
    saveLeaveRequest(request: Partial<LeaveRequest>): LeaveRequest {
        const list = this.getLeaveRequests();
        if (request.id) {
            const index = list.findIndex(l => l.id === request.id);
            if (index !== -1) {
                list[index] = { ...list[index], ...request } as LeaveRequest;
                saveToStorage(STORAGE_KEYS.LEAVE, list);
                return list[index];
            }
        }
        const newLeave: LeaveRequest = {
            id: Date.now(),
            employeeId: request.employeeId || 101,
            employeeName: request.employeeName || 'Staff Member',
            department: request.department,
            leaveType: request.leaveType || 'Annual Leave',
            startDate: request.startDate || getTodayDateStr(),
            endDate: request.endDate || getTodayDateStr(),
            days: request.days || 1,
            reason: request.reason || 'Personal Leave',
            handoverTo: request.handoverTo,
            status: 'pending',
            appliedOn: getTodayDateStr()
        };
        list.unshift(newLeave);
        saveToStorage(STORAGE_KEYS.LEAVE, list);
        return newLeave;
    },
    updateLeaveStatus(id: number, status: 'approved' | 'rejected', notes?: string, approver: string = 'HR Admin'): void {
        const list = this.getLeaveRequests();
        const item = list.find(l => l.id === id);
        if (item) {
            item.status = status;
            item.approvedBy = approver;
            item.approvedOn = getTodayDateStr();
            if (notes) item.managerNotes = notes;
            saveToStorage(STORAGE_KEYS.LEAVE, list);

            // If approved annual leave, update employee leave taken
            if (status === 'approved' && item.leaveType === 'Annual Leave') {
                const employees = this.getEmployees();
                const emp = employees.find(e => e.id === item.employeeId);
                if (emp) {
                    emp.annualLeaveTaken = (emp.annualLeaveTaken || 0) + item.days;
                    saveToStorage(STORAGE_KEYS.EMPLOYEES, employees);
                }
            }
        }
    },

    // Performance
    getPerformanceReviews(): PerformanceReview[] {
        return loadFromStorage<PerformanceReview[]>(STORAGE_KEYS.PERFORMANCE, INITIAL_PERFORMANCE);
    },
    savePerformanceReview(review: Partial<PerformanceReview>): PerformanceReview {
        const list = this.getPerformanceReviews();
        if (review.id) {
            const index = list.findIndex(p => p.id === review.id);
            if (index !== -1) {
                list[index] = { ...list[index], ...review } as PerformanceReview;
                saveToStorage(STORAGE_KEYS.PERFORMANCE, list);
                return list[index];
            }
        }
        const pScore = review.punctualityScore || 5;
        const cScore = review.customerServiceScore || 5;
        const aScore = review.accuracyScore || 5;
        const tScore = review.teamworkScore || 5;
        const avg = Number(((pScore + cScore + aScore + tScore) / 4).toFixed(1));

        const newReview: PerformanceReview = {
            id: Date.now(),
            employeeId: review.employeeId || 101,
            employeeName: review.employeeName || 'Staff Member',
            jobTitle: review.jobTitle,
            reviewPeriod: review.reviewPeriod || 'Q3 2026',
            salesVolume: review.salesVolume || 0,
            transactionsHandled: review.transactionsHandled || 0,
            punctualityScore: pScore,
            customerServiceScore: cScore,
            accuracyScore: aScore,
            teamworkScore: tScore,
            overallRating: avg,
            strengths: review.strengths || 'Diligent and consistent contributor.',
            areasForImprovement: review.areasForImprovement || 'Continue skill specialization.',
            goals: review.goals || 'Maintain high customer satisfaction and punctual shifts.',
            reviewer: review.reviewer || 'HR Manager',
            date: getTodayDateStr()
        };
        list.unshift(newReview);
        saveToStorage(STORAGE_KEYS.PERFORMANCE, list);
        return newReview;
    },

    // Documents
    getDocuments(): HRDocument[] {
        return loadFromStorage<HRDocument[]>(STORAGE_KEYS.DOCUMENTS, INITIAL_DOCUMENTS);
    },
    saveDocument(doc: Partial<HRDocument>): HRDocument {
        const list = this.getDocuments();
        const newDoc: HRDocument = {
            id: Date.now(),
            title: doc.title || 'Untitled HR Document',
            category: doc.category || 'Policy',
            employeeId: doc.employeeId,
            employeeName: doc.employeeName,
            fileSize: doc.fileSize || '500 KB',
            uploadDate: getTodayDateStr(),
            expiryDate: doc.expiryDate,
            status: doc.status || 'valid'
        };
        list.unshift(newDoc);
        saveToStorage(STORAGE_KEYS.DOCUMENTS, list);
        return newDoc;
    },
    deleteDocument(id: number): void {
        const list = this.getDocuments().filter(d => d.id !== id);
        saveToStorage(STORAGE_KEYS.DOCUMENTS, list);
    }
};
