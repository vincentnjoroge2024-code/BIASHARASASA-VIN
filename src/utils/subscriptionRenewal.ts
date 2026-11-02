import { Trader, SubscriptionPlan, RenewalNotificationInfo, getCurrencyByLocation } from '../types';

/**
 * Calculates subscription renewal metrics for a given trader.
 * Evaluates whether renewal is due within the next 7 days or overdue.
 */
export function calculateTraderRenewal(
    trader: Trader, 
    plans?: SubscriptionPlan[],
    referenceDate: Date = new Date()
): RenewalNotificationInfo {
    const currency = getCurrencyByLocation(trader.location);
    const planName = trader.plan || 'Basic';

    // Base pricing lookup
    let basePriceUSD = 30;
    if (planName.toLowerCase() === 'pro') basePriceUSD = 50;
    if (planName.toLowerCase() === 'enterprise') basePriceUSD = 250;
    if (planName.toLowerCase() === 'distributor') basePriceUSD = 500;

    // Surcharges for optional add-on modules (+50% fee of plan cost each if active)
    let moduleSurchargeMultiplier = 1.0;
    if (trader.financeActive) moduleSurchargeMultiplier += 0.5;
    if (trader.taxActive) moduleSurchargeMultiplier += 0.5;
    if (trader.productionActive) moduleSurchargeMultiplier += 0.5;
    if (trader.hrActive) moduleSurchargeMultiplier += 0.5;

    const totalMonthlyUSD = basePriceUSD * moduleSurchargeMultiplier;
    // Approximate local rate conversion ($1 = 130 KSh / 3800 UGX / etc. or 100 base)
    const totalMonthlyLocal = Math.round(totalMonthlyUSD * 100);

    // Parse or calculate expiration date
    let expiryDate: Date;
    if (trader.subscriptionExpiresAt) {
        expiryDate = new Date(trader.subscriptionExpiresAt);
        // Handle timezone issues or invalid date strings
        if (isNaN(expiryDate.getTime())) {
            expiryDate = calculateDefaultRenewalDate(trader, referenceDate);
        }
    } else {
        expiryDate = calculateDefaultRenewalDate(trader, referenceDate);
    }

    // Days difference calculation
    const startOfToday = new Date(referenceDate.getFullYear(), referenceDate.getMonth(), referenceDate.getDate()).getTime();
    const startOfExpiry = new Date(expiryDate.getFullYear(), expiryDate.getMonth(), expiryDate.getDate()).getTime();
    const diffMs = startOfExpiry - startOfToday;
    const daysRemaining = Math.round(diffMs / (1000 * 60 * 60 * 24));

    const isOverdue = daysRemaining < 0;
    const isUrgent = daysRemaining >= 0 && daysRemaining <= 3;
    const isDueSoon = daysRemaining >= 0 && daysRemaining <= 7;

    let statusSeverity: 'urgent' | 'warning' | 'normal' | 'overdue' = 'normal';
    let statusLabel = 'Active';

    if (isOverdue) {
        statusSeverity = 'overdue';
        statusLabel = `Expired (${Math.abs(daysRemaining)}d ago)`;
    } else if (isUrgent) {
        statusSeverity = 'urgent';
        statusLabel = daysRemaining === 0 ? 'Expires today' : `Expires in ${daysRemaining} day${daysRemaining > 1 ? 's' : ''}`;
    } else if (isDueSoon) {
        statusSeverity = 'warning';
        statusLabel = `Renewal due in ${daysRemaining} days`;
    } else {
        statusSeverity = 'normal';
        statusLabel = `Active (${daysRemaining} days left)`;
    }

    const expiryDateFormatted = expiryDate.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric'
    });

    return {
        traderId: trader.id,
        traderName: trader.fullName || 'Merchant',
        businessName: trader.businessName || 'Business Store',
        location: trader.location || 'Nairobi',
        planName,
        monthlyFeeUSD: totalMonthlyUSD,
        monthlyFeeLocal: totalMonthlyLocal,
        currencySymbol: currency.symbol,
        currencyCode: currency.code,
        expiryDate,
        expiryDateFormatted,
        daysRemaining,
        isDueSoon: isDueSoon || isOverdue, // flag true if within 7 days or overdue
        isUrgent,
        isOverdue,
        statusLabel,
        statusSeverity,
        financeActive: trader.financeActive,
        taxActive: trader.taxActive,
        productionActive: trader.productionActive,
        hrActive: trader.hrActive
    };
}

/**
 * Calculates deterministic next renewal date when subscriptionExpiresAt is not yet stored.
 */
function calculateDefaultRenewalDate(trader: Trader, referenceDate: Date): Date {
    const joinedStr = trader.customerSince || trader.joined || '2025-01-15';
    const joinedDate = new Date(joinedStr);
    const dayOfMonth = isNaN(joinedDate.getDate()) ? 15 : joinedDate.getDate();

    // Default to the current month or next cycle
    const candidate = new Date(referenceDate.getFullYear(), referenceDate.getMonth(), dayOfMonth);
    if (candidate < referenceDate) {
        // If already passed in current month, next month's billing day
        candidate.setMonth(candidate.getMonth() + 1);
    }
    return candidate;
}

/**
 * Filters all traders whose subscriptions are due for renewal within the next 7 days (or overdue).
 * Sorts from most urgent (overdue / fewer days remaining) to least urgent.
 */
export function getExpiringTradersList(
    traders: Trader[], 
    plans?: SubscriptionPlan[],
    maxDays: number = 7,
    referenceDate: Date = new Date()
): RenewalNotificationInfo[] {
    return traders
        .map(t => calculateTraderRenewal(t, plans, referenceDate))
        .filter(info => info.daysRemaining <= maxDays)
        .sort((a, b) => a.daysRemaining - b.daysRemaining);
}
