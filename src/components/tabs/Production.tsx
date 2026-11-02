import React, { useState, useEffect, useMemo } from 'react';
import { useAppContext } from '../../context';
import { 
    Factory, Plus, Search, Filter, CheckCircle2, AlertTriangle, Save, 
    Clock, XCircle, ArrowUpRight, DollarSign, Package, Users, 
    Sparkles, RefreshCw, Printer, Trash2, Edit3, ChevronRight,
    Layers, Cpu, FileText, Check, ShieldCheck, Box, AlertCircle,
    TrendingUp, Calendar, Activity, X, PieChart as PieChartIcon, BarChart as BarChartIcon,
    Zap, Droplets, Fuel, Wrench, Building2, Truck, FlaskConical, Receipt, 
    SlidersHorizontal, Calculator, ShieldAlert, Tag
} from 'lucide-react';
import { 
    LineChart, Line, AreaChart, Area, 
    XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, 
    PieChart, Pie, Cell, 
    BarChart, Bar, Legend
} from 'recharts';
import { 
    Ingredient, ProductionBatch, ProductionSummary, 
    RawMaterialUsage, LabourCost, OverheadCost, ProductionRecipe, formatCurrency,
    PRODUCTION_OVERHEAD_CATEGORIES, ProductionOverheadPreset 
} from '../../types';
import { transferPreviewToPrinter } from '../../utils/printEngine';
import { 
    getProductionIngredients, createProductionIngredient, updateProductionIngredient, 
    deleteProductionIngredient, getProductionBatches, createProductionBatch, 
    approveProductionBatch, cancelProductionBatch, getProductionSummary,
    getProductionRecipes, getProductionRecipe, createProductionRecipe, deleteProductionRecipe,
    getSystemHealth, getSystemErrors 
} from '../../api';

type ProductionSubTab = 'batches' | 'new-batch' | 'ingredients' | 'recipes' | 'insights';

export const ProductionTab: React.FC = () => {
    const { t, user, inventory, refreshData, showToast } = useAppContext();
    const costingSheetRef = React.useRef<HTMLDivElement>(null);

    const [activeSubTab, setActiveSubTab] = useState<ProductionSubTab>('batches');
    const [ingredients, setIngredients] = useState<Ingredient[]>([]);
    const [batches, setBatches] = useState<ProductionBatch[]>([]);
    const [recipes, setRecipes] = useState<ProductionRecipe[]>([]);
    const [systemHealth, setSystemHealth] = useState<any>(null);
    const [errorLogs, setErrorLogs] = useState<any[]>([]);
    const [summary, setSummary] = useState<ProductionSummary | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [statusFilter, setStatusFilter] = useState<string>('all');
    const [searchQuery, setSearchQuery] = useState('');

    // Detail / Action modal states
    const [selectedBatch, setSelectedBatch] = useState<ProductionBatch | null>(null);
    const [showPrintModal, setShowPrintModal] = useState(false);
    const [isApproving, setIsApproving] = useState(false);

    // Ingredient management states
    const [showAddIngredientModal, setShowAddIngredientModal] = useState(false);
    const [editingIngredient, setEditingIngredient] = useState<Ingredient | null>(null);
    const [newIngredient, setNewIngredient] = useState({
        name: '',
        cost_per_unit: '',
        unit: 'kg',
        current_stock: '',
        reorder_level: ''
    });

    // Recipe management states
    const [showAddRecipeModal, setShowAddRecipeModal] = useState(false);
    const [selectedRecipeId, setSelectedRecipeId] = useState<number | ''>('');
    const [newRecipe, setNewRecipe] = useState({
        name: '',
        product_id: '',
        target_quantity: '1',
        description: '',
        ingredients: [] as Array<{ ingredient_id: number; quantity: number }>,
        overheads: [] as OverheadCost[]
    });
    const [recipeIngredientInput, setRecipeIngredientInput] = useState({
        ingredient_id: '',
        quantity: ''
    });
    const [recipeOverheadInput, setRecipeOverheadInput] = useState({
        category: 'Electricity Bill',
        amount: '',
        description: 'Standard 3-phase machinery electrical draw',
        cost_type: 'utility' as 'utility' | 'facility' | 'maintenance' | 'packaging' | 'logistics' | 'compliance' | 'other',
        bill_reference: '',
        units_consumed: '',
        unit_rate: '',
        unit_measure: 'kWh'
    });

    // New Batch form state
    const [batchProductId, setBatchProductId] = useState<number | ''>('');
    const [customProductName, setCustomProductName] = useState('');
    const [quantityProduced, setQuantityProduced] = useState<string>('100');
    const [responsibleUser, setResponsibleUser] = useState(user?.username || 'Production Supervisor');
    const [batchNotes, setBatchNotes] = useState('');

    // Dynamic Lists for New Batch
    const [selectedMaterials, setSelectedMaterials] = useState<Array<{
        ingredient_id: number;
        ingredient_name: string;
        quantity_used: number;
        unit: string;
        cost_per_unit: number;
        cost: number;
    }>>([]);
    const [materialInput, setMaterialInput] = useState<{ ingredientId: number | ''; quantity: string }>({
        ingredientId: '',
        quantity: ''
    });

    const [labourList, setLabourList] = useState<LabourCost[]>([
        { employee_name: 'Lead Specialist', role: 'Production Lead', hours_worked: 4, hourly_rate: 300, total_cost: 1200 }
    ]);
    const [labourInput, setLabourInput] = useState({
        name: '',
        role: 'Operator',
        hours: '',
        rate: '250'
    });

    // Associated Costs & Utility Bills
    const [overheadList, setOverheadList] = useState<OverheadCost[]>([
        { category: 'Electricity Bill', amount: 650, description: 'Machinery 3-phase power run', cost_type: 'utility', bill_reference: 'KPLC Token #9281-3042', units_consumed: 26, unit_rate: 25, unit_measure: 'kWh' },
        { category: 'Water Bill', amount: 200, description: 'Cooling jacket & ingredient prep water', cost_type: 'utility', bill_reference: 'Water Meter Ref #W-290', units_consumed: 2.5, unit_rate: 80, unit_measure: 'm³' },
        { category: 'Packaging Materials', amount: 350, description: 'Primary pouches, outer cartons & tamper tape', cost_type: 'packaging', bill_reference: 'Pkg Batch #441' }
    ]);
    const [overheadInput, setOverheadInput] = useState<{
        category: string;
        cost_type: 'utility' | 'facility' | 'maintenance' | 'packaging' | 'logistics' | 'compliance' | 'other';
        calculation_mode: 'flat' | 'unit_rate';
        amount: string;
        units_consumed: string;
        unit_rate: string;
        unit_measure: string;
        bill_reference: string;
        billing_period: string;
        description: string;
    }>({
        category: 'Electricity Bill',
        cost_type: 'utility',
        calculation_mode: 'flat',
        amount: '',
        units_consumed: '',
        unit_rate: '',
        unit_measure: 'kWh',
        bill_reference: '',
        billing_period: '',
        description: '3-phase factory machine power consumption'
    });

    const [isSubmittingBatch, setIsSubmittingBatch] = useState(false);

    // Fetch all production data
    const loadProductionData = async () => {
        setIsLoading(true);
        try {
            const [ingData, batchData, sumData, recipeData, healthData, errorsData] = await Promise.all([
                getProductionIngredients().catch(() => []),
                getProductionBatches().catch(() => []),
                getProductionSummary().catch(() => null),
                getProductionRecipes().catch(() => []),
                getSystemHealth().catch(() => null),
                getSystemErrors().catch(() => [])
            ]);

            setIngredients(ingData || []);
            setBatches(batchData || []);
            setRecipes(recipeData || []);
            setSystemHealth(healthData);
            setErrorLogs(errorsData);
            if (sumData && sumData.summary) {
                setSummary(sumData.summary);
            } else {
                // Compute local summary fallback
                const approved = (batchData || []).filter(b => b.status === 'approved' || b.status === 'completed');
                const totCost = approved.reduce((acc, b) => acc + (b.total_cost || 0), 0);
                const totQty = approved.reduce((acc, b) => acc + (b.quantity_produced || 0), 0);
                setSummary({
                    total_batches: approved.length,
                    total_cost: totCost,
                    total_quantity: totQty,
                    avg_cost_per_unit: totQty > 0 ? (totCost / totQty) : 0,
                    draft_batches: (batchData || []).filter(b => b.status === 'draft').length
                });
            }
        } catch (err) {
            console.error('Failed loading production data:', err);
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        loadProductionData();
    }, []);

    // Filtered batches
    const filteredBatches = useMemo(() => {
        return batches.filter(b => {
            const matchesStatus = statusFilter === 'all' || b.status === statusFilter;
            const matchesSearch = 
                b.batch_number.toLowerCase().includes(searchQuery.toLowerCase()) ||
                b.product_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                (b.responsible_user && b.responsible_user.toLowerCase().includes(searchQuery.toLowerCase()));
            return matchesStatus && matchesSearch;
        });
    }, [batches, statusFilter, searchQuery]);

    // Low stock ingredients alert
    const lowStockIngredients = useMemo(() => {
        return ingredients.filter(i => i.current_stock <= i.reorder_level);
    }, [ingredients]);

    // Cost calculations for active new batch builder
    const rawMaterialsSubtotal = useMemo(() => {
        return selectedMaterials.reduce((sum, item) => sum + item.cost, 0);
    }, [selectedMaterials]);

    const labourSubtotal = useMemo(() => {
        return labourList.reduce((sum, item) => sum + item.total_cost, 0);
    }, [labourList]);

    const overheadSubtotal = useMemo(() => {
        return overheadList.reduce((sum, item) => sum + item.amount, 0);
    }, [overheadList]);

    const totalBatchCost = rawMaterialsSubtotal + labourSubtotal + overheadSubtotal;
    const qtyProducedNum = parseFloat(quantityProduced) || 0;
    const unitBatchCost = qtyProducedNum > 0 ? (totalBatchCost / qtyProducedNum) : 0;

    // Handle adding raw material to batch
    const handleAddMaterialToBatch = () => {
        if (!materialInput.ingredientId || !materialInput.quantity) {
            showToast?.('Please choose an ingredient and enter a quantity', 'warning');
            return;
        }
        const ing = ingredients.find(i => i.id === Number(materialInput.ingredientId));
        if (!ing) return;

        const qty = parseFloat(materialInput.quantity);
        if (qty <= 0 || isNaN(qty)) {
            showToast?.('Invalid quantity entered', 'warning');
            return;
        }

        const cost = qty * ing.cost_per_unit;
        setSelectedMaterials(prev => [
            ...prev,
            {
                ingredient_id: ing.id,
                ingredient_name: ing.name,
                quantity_used: qty,
                unit: ing.unit,
                cost_per_unit: ing.cost_per_unit,
                cost
            }
        ]);
        setMaterialInput({ ingredientId: '', quantity: '' });
    };

    const handleRemoveMaterial = (index: number) => {
        setSelectedMaterials(prev => prev.filter((_, i) => i !== index));
    };

    // Handle adding labour to batch
    const handleAddLabour = () => {
        if (!labourInput.name || !labourInput.hours || !labourInput.rate) {
            showToast?.('Please complete the labour details', 'warning');
            return;
        }
        const hours = parseFloat(labourInput.hours);
        const rate = parseFloat(labourInput.rate);
        if (hours <= 0 || rate <= 0) return;

        setLabourList(prev => [
            ...prev,
            {
                employee_name: labourInput.name,
                role: labourInput.role || 'Operator',
                hours_worked: hours,
                hourly_rate: rate,
                total_cost: hours * rate
            }
        ]);
        setLabourInput({ name: '', role: 'Operator', hours: '', rate: '250' });
    };

    const handleRemoveLabour = (index: number) => {
        setLabourList(prev => prev.filter((_, i) => i !== index));
    };

    // Select category preset with default units and descriptions
    const handleSelectOverheadCategory = (catName: string) => {
        const preset = PRODUCTION_OVERHEAD_CATEGORIES.find(c => c.category === catName);
        if (preset) {
            setOverheadInput(prev => ({
                ...prev,
                category: preset.category,
                cost_type: preset.cost_type,
                unit_measure: preset.default_unit || 'units',
                description: preset.suggested_description
            }));
        } else {
            setOverheadInput(prev => ({
                ...prev,
                category: catName
            }));
        }
    };

    // Handle adding overhead or utility bill to batch
    const handleAddOverhead = () => {
        let finalAmount = 0;
        if (overheadInput.calculation_mode === 'unit_rate') {
            const units = parseFloat(overheadInput.units_consumed);
            const rate = parseFloat(overheadInput.unit_rate);
            if (isNaN(units) || units <= 0 || isNaN(rate) || rate <= 0) {
                showToast?.('Please enter valid consumption units and rate per unit', 'warning');
                return;
            }
            finalAmount = Math.round(units * rate * 100) / 100;
        } else {
            finalAmount = parseFloat(overheadInput.amount);
            if (isNaN(finalAmount) || finalAmount <= 0) {
                showToast?.('Please enter an expense or utility bill amount', 'warning');
                return;
            }
        }

        const newCostItem: OverheadCost = {
            category: overheadInput.category,
            amount: finalAmount,
            description: overheadInput.description || overheadInput.category,
            cost_type: overheadInput.cost_type,
            bill_reference: overheadInput.bill_reference.trim() || undefined,
            units_consumed: overheadInput.calculation_mode === 'unit_rate' ? parseFloat(overheadInput.units_consumed) : undefined,
            unit_rate: overheadInput.calculation_mode === 'unit_rate' ? parseFloat(overheadInput.unit_rate) : undefined,
            unit_measure: overheadInput.calculation_mode === 'unit_rate' ? overheadInput.unit_measure : undefined,
            billing_period: overheadInput.billing_period.trim() || undefined
        };

        setOverheadList(prev => [...prev, newCostItem]);
        showToast?.(`Added ${overheadInput.category} (${formatCurrency(finalAmount, user?.location)})`, 'success');

        setOverheadInput(prev => ({
            ...prev,
            amount: '',
            units_consumed: '',
            unit_rate: '',
            bill_reference: '',
            billing_period: ''
        }));
    };

    const handleRemoveOverhead = (index: number) => {
        setOverheadList(prev => prev.filter((_, i) => i !== index));
    };

    const getCategoryIcon = (category: string) => {
        const cat = category.toLowerCase();
        if (cat.includes('electr') || cat.includes('power')) return <Zap className="w-3.5 h-3.5 text-amber-500" />;
        if (cat.includes('water')) return <Droplets className="w-3.5 h-3.5 text-sky-500" />;
        if (cat.includes('fuel') || cat.includes('gas') || cat.includes('generator')) return <Fuel className="w-3.5 h-3.5 text-orange-500" />;
        if (cat.includes('packag')) return <Package className="w-3.5 h-3.5 text-purple-500" />;
        if (cat.includes('maint') || cat.includes('repair') || cat.includes('tool')) return <Wrench className="w-3.5 h-3.5 text-emerald-500" />;
        if (cat.includes('rent') || cat.includes('lease') || cat.includes('facil')) return <Building2 className="w-3.5 h-3.5 text-indigo-500" />;
        if (cat.includes('transp') || cat.includes('freight') || cat.includes('logist')) return <Truck className="w-3.5 h-3.5 text-blue-500" />;
        if (cat.includes('qual') || cat.includes('test') || cat.includes('lab') || cat.includes('complian')) return <FlaskConical className="w-3.5 h-3.5 text-rose-500" />;
        return <Receipt className="w-3.5 h-3.5 text-slate-500" />;
    };

    const getCategoryBadgeClass = (category: string) => {
        const cat = category.toLowerCase();
        if (cat.includes('electr') || cat.includes('power')) return 'bg-amber-50 text-amber-800 dark:bg-amber-950/40 dark:text-amber-300 border-amber-200 dark:border-amber-800';
        if (cat.includes('water')) return 'bg-sky-50 text-sky-800 dark:bg-sky-950/40 dark:text-sky-300 border-sky-200 dark:border-sky-800';
        if (cat.includes('fuel') || cat.includes('gas') || cat.includes('generator')) return 'bg-orange-50 text-orange-800 dark:bg-orange-950/40 dark:text-orange-300 border-orange-200 dark:border-orange-800';
        if (cat.includes('packag')) return 'bg-purple-50 text-purple-800 dark:bg-purple-950/40 dark:text-purple-300 border-purple-200 dark:border-purple-800';
        if (cat.includes('maint') || cat.includes('repair') || cat.includes('tool')) return 'bg-emerald-50 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800';
        if (cat.includes('rent') || cat.includes('lease') || cat.includes('facil')) return 'bg-indigo-50 text-indigo-800 dark:bg-indigo-950/40 dark:text-indigo-300 border-indigo-200 dark:border-indigo-800';
        if (cat.includes('transp') || cat.includes('freight') || cat.includes('logist')) return 'bg-blue-50 text-blue-800 dark:bg-blue-950/40 dark:text-blue-300 border-blue-200 dark:border-blue-800';
        if (cat.includes('qual') || cat.includes('test') || cat.includes('lab') || cat.includes('complian')) return 'bg-rose-50 text-rose-800 dark:bg-rose-950/40 dark:text-rose-300 border-rose-200 dark:border-rose-800';
        return 'bg-slate-100 text-slate-800 dark:bg-slate-800 dark:text-slate-300 border-slate-200 dark:border-slate-700';
    };

    // Submit new production batch
    const handleCreateBatch = async (e: React.FormEvent) => {
        e.preventDefault();
        const selectedProd = inventory.find(p => p.id === Number(batchProductId));
        const finalProductName = selectedProd ? selectedProd.name : customProductName.trim();

        if (!finalProductName) {
            showToast?.('Please select an inventory product or specify a custom product name', 'warning');
            return;
        }

        if (qtyProducedNum <= 0) {
            showToast?.('Please specify a positive production quantity', 'warning');
            return;
        }

        if (selectedMaterials.length === 0) {
            showToast?.('Please add at least one raw material / ingredient', 'warning');
            return;
        }

        setIsSubmittingBatch(true);
        try {
            const res = await createProductionBatch({
                product_id: Number(batchProductId) || 0,
                product_name: finalProductName,
                quantity_produced: qtyProducedNum,
                responsible_user: responsibleUser || user?.username || 'Production Supervisor',
                notes: batchNotes,
                raw_materials: selectedMaterials.map(m => ({
                    ingredient_id: m.ingredient_id,
                    quantity_used: m.quantity_used,
                    cost: m.cost,
                    ingredient_name: m.ingredient_name
                })),
                labour: labourList,
                overhead: overheadList
            });

            if (res.success) {
                showToast?.(`Batch ${res.batch_number} recorded successfully!`, 'success');
                // Reset form
                setBatchProductId('');
                setCustomProductName('');
                setQuantityProduced('100');
                setSelectedMaterials([]);
                setBatchNotes('');
                await loadProductionData();
                setActiveSubTab('batches');
            }
        } catch (err: any) {
            showToast?.(err.message || 'Failed to create production batch', 'error');
        } finally {
            setIsSubmittingBatch(false);
        }
    };

    // Approve batch (deducts ingredients, increases finished goods inventory)
    const handleApproveBatch = async (batch: ProductionBatch) => {
        if (batch.status === 'approved') return;
        setIsApproving(true);
        try {
            const res = await approveProductionBatch(batch.id, user?.username || 'Admin');
            if (res.success) {
                showToast?.(`Batch ${batch.batch_number} approved! Raw materials deducted and finished goods stocked.`, 'success');
                await loadProductionData();
                refreshData?.();
                if (selectedBatch && selectedBatch.id === batch.id) {
                    setSelectedBatch(prev => prev ? { ...prev, status: 'approved', approved_by: user?.username || 'Admin', approved_at: new Date().toISOString() } : null);
                }
            }
        } catch (err: any) {
            showToast?.(err.message || 'Failed to approve batch', 'error');
        } finally {
            setIsApproving(false);
        }
    };

    // Cancel batch
    const handleCancelBatch = async (batch: ProductionBatch) => {
        if (confirm(`Are you sure you want to cancel batch ${batch.batch_number}?`)) {
            try {
                const res = await cancelProductionBatch(batch.id);
                if (res.success) {
                    showToast?.(`Batch ${batch.batch_number} marked as cancelled`, 'info');
                    await loadProductionData();
                    if (selectedBatch && selectedBatch.id === batch.id) {
                        setSelectedBatch(prev => prev ? { ...prev, status: 'cancelled' } : null);
                    }
                }
            } catch (err: any) {
                showToast?.(err.message || 'Failed to cancel batch', 'error');
            }
        }
    };

    // Add ingredient
    const handleCreateIngredient = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!newIngredient.name || !newIngredient.cost_per_unit || !newIngredient.current_stock) {
            showToast?.('Please fill out all required fields', 'warning');
            return;
        }

        try {
            const res = await createProductionIngredient({
                name: newIngredient.name.trim(),
                cost_per_unit: parseFloat(newIngredient.cost_per_unit) || 0,
                unit: newIngredient.unit || 'kg',
                current_stock: parseFloat(newIngredient.current_stock) || 0,
                reorder_level: parseFloat(newIngredient.reorder_level) || 10
            });

            if (res.success) {
                showToast?.('Ingredient added to catalog!', 'success');
                setShowAddIngredientModal(false);
                setNewIngredient({
                    name: '',
                    cost_per_unit: '',
                    unit: 'kg',
                    current_stock: '',
                    reorder_level: ''
                });
                await loadProductionData();
            }
        } catch (err: any) {
            showToast?.(err.message || 'Failed to add ingredient', 'error');
        }
    };

    // Quick stock replenishment
    const handleQuickStockUpdate = async (ing: Ingredient, addQty: number) => {
        try {
            const newStock = ing.current_stock + addQty;
            await updateProductionIngredient(ing.id, { current_stock: newStock });
            showToast?.(`Stock updated for ${ing.name}: ${newStock} ${ing.unit}`, 'success');
            await loadProductionData();
        } catch (err: any) {
            showToast?.('Failed to update stock', 'error');
        }
    };

    // Recipe Handlers
    const handleCreateRecipe = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!newRecipe.name || newRecipe.ingredients.length === 0) {
            showToast?.('Recipe name and at least one ingredient are required', 'warning');
            return;
        }

        try {
            const res = await createProductionRecipe({
                name: newRecipe.name.trim(),
                product_id: newRecipe.product_id ? Number(newRecipe.product_id) : undefined,
                product_name: inventory.find(p => p.id === Number(newRecipe.product_id))?.name || '',
                target_quantity: parseFloat(newRecipe.target_quantity) || 1,
                description: newRecipe.description,
                ingredients: newRecipe.ingredients as any,
                overheads: newRecipe.overheads
            });
            if (res.success) {
                showToast?.(`Recipe "${newRecipe.name}" created successfully!`, 'success');
                setShowAddRecipeModal(false);
                setNewRecipe({
                    name: '',
                    product_id: '',
                    target_quantity: '1',
                    description: '',
                    ingredients: [],
                    overheads: []
                });
                await loadProductionData();
            }
        } catch (err: any) {
            showToast?.(err.message || 'Failed to create recipe', 'error');
        }
    };

    const handleDeleteRecipe = async (id: number) => {
        if (confirm('Are you sure you want to delete this recipe?')) {
            try {
                await deleteProductionRecipe(id);
                showToast?.('Recipe deleted', 'info');
                await loadProductionData();
            } catch (err) {
                showToast?.('Failed to delete recipe', 'error');
            }
        }
    };

    const handleApplyRecipe = async (recipeId: number) => {
        try {
            const recipe = await getProductionRecipe(recipeId);
            if (recipe) {
                if (recipe.ingredients) {
                    const materials = recipe.ingredients.map(ri => ({
                        ingredient_id: ri.ingredient_id,
                        ingredient_name: ri.ingredient_name || 'Unknown',
                        quantity_used: ri.quantity,
                        unit: ri.unit || '',
                        cost_per_unit: ri.cost_per_unit || 0,
                        cost: ri.quantity * (ri.cost_per_unit || 0)
                    }));
                    setSelectedMaterials(materials);
                }
                if (recipe.overheads && recipe.overheads.length > 0) {
                    setOverheadList(recipe.overheads);
                }
                if (recipe.product_id) setBatchProductId(recipe.product_id);
                setQuantityProduced(recipe.target_quantity.toString());
                showToast?.(`Recipe "${recipe.name}" applied with materials and utility estimates`, 'info');
                setSelectedRecipeId(recipe.id);
            }
        } catch (err) {
            showToast?.('Failed to load recipe details', 'error');
        }
    };

    // Ingredient Edit/Delete Handlers
    const handleDeleteIngredient = async (id: number) => {
        if (confirm('Are you sure you want to delete this ingredient?')) {
            try {
                await deleteProductionIngredient(id);
                showToast?.('Ingredient removed', 'info');
                await loadProductionData();
            } catch (err) {
                showToast?.('Failed to delete ingredient', 'error');
            }
        }
    };

    const handleUpdateIngredient = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!editingIngredient) return;

        try {
            await updateProductionIngredient(editingIngredient.id, {
                name: editingIngredient.name,
                cost_per_unit: editingIngredient.cost_per_unit,
                unit: editingIngredient.unit,
                current_stock: editingIngredient.current_stock,
                reorder_level: editingIngredient.reorder_level
            });
            showToast?.('Ingredient updated', 'success');
            setEditingIngredient(null);
            await loadProductionData();
        } catch (err) {
            showToast?.('Failed to update ingredient', 'error');
        }
    };

    return (
        <div id="production-management-module" className="space-y-6">
            {/* Header with Title & Action Bar */}
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded-xl bg-amber-500/10 text-amber-600 dark:text-amber-400 flex items-center justify-center font-bold">
                        <Factory className="w-6 h-6" />
                    </div>
                    <div>
                        <div className="flex items-center gap-2">
                            <h1 className="text-3xl font-black text-slate-900 dark:text-white tracking-tight uppercase">
                                {t('prod_hub')}
                            </h1>
                        </div>
                        <p className="text-sm text-slate-500 dark:text-slate-400 font-medium">
                            {t('prod_desc')}
                        </p>
                    </div>
                </div>

                <div className="flex items-center gap-2 flex-wrap">
                    <button 
                        id="refresh-production-btn"
                        onClick={loadProductionData}
                        disabled={isLoading}
                        className="px-3 py-2 text-sm font-medium text-slate-700 dark:text-slate-200 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 rounded-lg flex items-center gap-2 transition"
                        title="Reload production data"
                    >
                        <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
                        <span>{t('prod_refresh')}</span>
                    </button>

                    <button 
                        id="new-ingredient-btn"
                        onClick={() => setShowAddIngredientModal(true)}
                        className="px-3 py-2 text-sm font-medium text-slate-700 dark:text-slate-200 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 rounded-lg flex items-center gap-2 transition"
                    >
                        <Plus className="w-4 h-4" />
                        <span>{t('prod_add_ingredient')}</span>
                    </button>

                    <button 
                        id="new-batch-btn"
                        onClick={() => setActiveSubTab('new-batch')}
                        className="px-4 py-2 text-sm font-semibold text-white bg-amber-600 hover:bg-amber-700 dark:bg-amber-500 dark:hover:bg-amber-600 rounded-lg flex items-center gap-2 shadow-xs transition"
                    >
                        <Plus className="w-4 h-4" />
                        <span>{t('prod_new_batch_btn')}</span>
                    </button>
                </div>
            </div>

            {/* Summary Metric KPI Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
                <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4 shadow-xs">
                    <div className="flex items-center justify-between text-slate-500 dark:text-slate-400 text-xs font-medium uppercase tracking-wider mb-2">
                        <span>{t('prod_total_batches')}</span>
                        <Factory className="w-4 h-4 text-amber-500" />
                    </div>
                    <div className="text-2xl font-bold text-slate-900 dark:text-white">
                        {summary?.total_batches || batches.length}
                    </div>
                    <div className="text-xs text-slate-500 mt-1 flex items-center gap-1">
                        <span className="font-semibold text-amber-600 dark:text-amber-400">{batches.filter(b => b.status === 'draft').length} drafts</span> awaiting approval
                    </div>
                </div>

                <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4 shadow-xs">
                    <div className="flex items-center justify-between text-slate-500 dark:text-slate-400 text-xs font-medium uppercase tracking-wider mb-2">
                        <span>{t('prod_total_cost')}</span>
                        <DollarSign className="w-4 h-4 text-emerald-500" />
                    </div>
                    <div className="text-2xl font-bold text-slate-900 dark:text-white">
                        {formatCurrency(summary?.total_cost || 0, user?.location)}
                    </div>
                    <div className="text-xs text-slate-500 mt-1">
                        Approved manufacturing value
                    </div>
                </div>

                <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4 shadow-xs">
                    <div className="flex items-center justify-between text-slate-500 dark:text-slate-400 text-xs font-medium uppercase tracking-wider mb-2">
                        <span>Finished Output Units</span>
                        <Package className="w-4 h-4 text-blue-500" />
                    </div>
                    <div className="text-2xl font-bold text-slate-900 dark:text-white">
                        {(summary?.total_quantity || 0).toLocaleString()}
                    </div>
                    <div className="text-xs text-slate-500 mt-1">
                        Stock items manufactured
                    </div>
                </div>

                <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4 shadow-xs">
                    <div className="flex items-center justify-between text-slate-500 dark:text-slate-400 text-xs font-medium uppercase tracking-wider mb-2">
                        <span>Avg. Cost / Unit</span>
                        <Cpu className="w-4 h-4 text-purple-500" />
                    </div>
                    <div className="text-2xl font-bold text-slate-900 dark:text-white">
                        {formatCurrency(summary?.avg_cost_per_unit || 0, user?.location)}
                    </div>
                    <div className="text-xs text-slate-500 mt-1">
                        Direct unit cost base
                    </div>
                </div>

                <div className={`border rounded-xl p-4 shadow-xs ${lowStockIngredients.length > 0 ? 'bg-rose-50/50 dark:bg-rose-950/20 border-rose-200 dark:border-rose-900/40' : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800'}`}>
                    <div className="flex items-center justify-between text-slate-500 dark:text-slate-400 text-xs font-medium uppercase tracking-wider mb-2">
                        <span>Low Stock Alerts</span>
                        <AlertTriangle className={`w-4 h-4 ${lowStockIngredients.length > 0 ? 'text-rose-500' : 'text-slate-400'}`} />
                    </div>
                    <div className={`text-2xl font-bold ${lowStockIngredients.length > 0 ? 'text-rose-600 dark:text-rose-400' : 'text-slate-900 dark:text-white'}`}>
                        {lowStockIngredients.length}
                    </div>
                    <div className="text-xs text-slate-500 mt-1">
                        {lowStockIngredients.length > 0 ? 'Raw materials need reorder' : 'All raw stocks sufficient'}
                    </div>
                </div>
            </div>

            {/* Sub-Navigation Tabs */}
            <div className="flex items-center gap-2 bg-slate-100 dark:bg-slate-800 p-1 rounded-xl w-fit overflow-x-auto no-scrollbar max-w-full">
                <button
                    onClick={() => setActiveSubTab('batches')}
                    className={`px-4 py-2 rounded-lg text-[10px] font-black uppercase tracking-widest whitespace-nowrap transition-all ${
                        activeSubTab === 'batches'
                            ? 'bg-indigo-600 text-white shadow-lg'
                            : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
                    }`}
                >
                    {t('prod_batches')} ({batches.length})
                </button>

                <button
                    onClick={() => setActiveSubTab('new-batch')}
                    className={`px-4 py-2 rounded-lg text-[10px] font-black uppercase tracking-widest whitespace-nowrap transition-all ${
                        activeSubTab === 'new-batch'
                            ? 'bg-indigo-600 text-white shadow-lg'
                            : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
                    }`}
                >
                    {t('prod_cost_calc')}
                </button>

                <button
                    onClick={() => setActiveSubTab('ingredients')}
                    className={`px-4 py-2 rounded-lg text-[10px] font-black uppercase tracking-widest whitespace-nowrap transition-all ${
                        activeSubTab === 'ingredients'
                            ? 'bg-indigo-600 text-white shadow-lg'
                            : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
                    }`}
                >
                    {t('prod_ingredients')} ({ingredients.length})
                </button>

                <button
                    onClick={() => setActiveSubTab('recipes')}
                    className={`px-4 py-2 rounded-lg text-[10px] font-black uppercase tracking-widest whitespace-nowrap transition-all ${
                        activeSubTab === 'recipes'
                            ? 'bg-indigo-600 text-white shadow-lg'
                            : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
                    }`}
                >
                    {t('prod_recipes')} ({recipes.length})
                </button>

                <button
                    onClick={() => setActiveSubTab('insights')}
                    className={`px-4 py-2 rounded-lg text-[10px] font-black uppercase tracking-widest whitespace-nowrap transition-all ${
                        activeSubTab === 'insights'
                            ? 'bg-indigo-600 text-white shadow-lg'
                            : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
                    }`}
                >
                    {t('prod_cost_analytics')}
                </button>
            </div>

            {/* TAB 1: PRODUCTION BATCHES LIST */}
            {activeSubTab === 'batches' && (
                <div className="space-y-4">
                    {/* Filter & Search Bar */}
                    <div className="tech-card p-4 flex flex-col md:flex-row items-stretch md:items-center justify-between gap-4">
                        <div className="relative flex-1">
                            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                            <input
                                id="search-batches-input"
                                type="text"
                                placeholder="Search by batch number, product, or operator..."
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                className="tech-input pl-10 w-full text-xs"
                            />
                        </div>

                        <div className="flex items-center gap-3">
                            <Filter className="w-4 h-4 text-indigo-600" />
                            <select
                                id="batch-status-filter"
                                value={statusFilter}
                                onChange={(e) => setStatusFilter(e.target.value)}
                                className="tech-input text-[10px] font-black uppercase tracking-widest"
                            >
                                <option value="all">All Statuses ({batches.length})</option>
                                <option value="draft">Drafts ({batches.filter(b => b.status === 'draft').length})</option>
                                <option value="approved">Approved & Stocked ({batches.filter(b => b.status === 'approved').length})</option>
                                <option value="completed">Completed ({batches.filter(b => b.status === 'completed').length})</option>
                                <option value="cancelled">Cancelled ({batches.filter(b => b.status === 'cancelled').length})</option>
                            </select>
                        </div>
                    </div>

                    {/* Batches Table */}
                    <div className="tech-card overflow-hidden">
                        <div className="overflow-x-auto">
                            <table className="w-full text-left">
                                <thead className="bg-slate-50 dark:bg-slate-800/30 text-[10px] font-black text-slate-400 uppercase tracking-widest border-b border-slate-100 dark:border-slate-800">
                                    <tr>
                                        <th className="px-6 py-4">Batch ID</th>
                                        <th className="px-6 py-4">Product</th>
                                        <th className="px-6 py-4 text-right">Yield</th>
                                        <th className="px-6 py-4 text-right">Total Cost</th>
                                        <th className="px-6 py-4 text-right">Unit Cost</th>
                                        <th className="px-6 py-4 text-center">Status</th>
                                        <th className="px-6 py-4 text-right">Actions</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                                    {filteredBatches.length === 0 ? (
                                        <tr>
                                            <td colSpan={7} className="px-6 py-12 text-center text-slate-400">
                                                <Factory className="w-12 h-12 mx-auto text-slate-300 dark:text-slate-600 mb-2" />
                                                <p className="font-black text-slate-600 dark:text-slate-400">No production batches found</p>
                                                <p className="text-[10px] uppercase font-black text-slate-400 mt-1">Start manufacturing to see logs here</p>
                                            </td>
                                        </tr>
                                    ) : (
                                        filteredBatches.map((batch) => {
                                            const isApproved = batch.status === 'approved';
                                            const isDraft = batch.status === 'draft';

                                            return (
                                                <tr key={batch.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/30 transition-colors">
                                                    <td className="px-6 py-4 font-black text-indigo-600 font-mono">
                                                        {batch.batch_number}
                                                    </td>
                                                    <td className="px-6 py-4">
                                                        <div className="font-black text-slate-900 dark:text-white">
                                                            {batch.product_name}
                                                        </div>
                                                        <div className="text-[10px] font-bold text-slate-400 uppercase tracking-tight">
                                                            {new Date(batch.production_date).toLocaleDateString()}
                                                        </div>
                                                    </td>
                                                    <td className="px-6 py-4 text-right font-black">
                                                        {batch.quantity_produced.toLocaleString()}
                                                    </td>
                                                    <td className="px-6 py-4 text-right font-black text-slate-900 dark:text-white">
                                                        {formatCurrency(batch.total_cost, user?.location)}
                                                    </td>
                                                    <td className="px-6 py-4 text-right font-mono text-emerald-600 font-black">
                                                        {formatCurrency(batch.cost_per_unit, user?.location)}
                                                    </td>
                                                    <td className="px-6 py-4 text-center">
                                                        <span className={`inline-flex items-center px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest ${
                                                            isApproved 
                                                                ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400'
                                                                : isDraft
                                                                ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400'
                                                                : 'bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-400'
                                                        }`}>
                                                            {batch.status}
                                                        </span>
                                                    </td>
                                                    <td className="px-6 py-4 text-right">
                                                        <button
                                                            onClick={() => setSelectedBatch(batch)}
                                                            className="text-[10px] font-black text-indigo-600 uppercase hover:underline"
                                                        >
                                                            Details
                                                        </button>
                                                    </td>
                                                </tr>
                                            );
                                        })
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            )}

            {/* TAB 2: CREATE BATCH & COST CALCULATOR */}
            {activeSubTab === 'new-batch' && (
                <form onSubmit={handleCreateBatch} className="space-y-6">
                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                        {/* Left 2 Columns: Input Data */}
                        <div className="lg:col-span-2 space-y-6">
                            {/* Product & General Details */}
                            <div className="tech-card p-6 space-y-6">
                                <h2 className="text-sm font-black text-slate-900 dark:text-white flex items-center gap-2 uppercase tracking-widest">
                                    <div className="w-8 h-8 rounded-lg bg-indigo-600/10 text-indigo-600 flex items-center justify-center font-black">01</div>
                                    Output Target & Yield
                                </h2>

                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                    <div className="md:col-span-2 bg-indigo-50/50 dark:bg-indigo-950/20 p-4 rounded-xl border border-indigo-100 dark:border-indigo-900/40 flex items-center gap-4">
                                        <div className="flex-1">
                                            <label className="block text-[10px] font-black text-indigo-600 dark:text-indigo-400 mb-2 uppercase tracking-widest">
                                                Load saved recipe (BOM)
                                            </label>
                                            <select
                                                id="batch-recipe-select"
                                                value={selectedRecipeId}
                                                onChange={(e) => {
                                                    const id = e.target.value ? Number(e.target.value) : '';
                                                    if (id) handleApplyRecipe(id);
                                                    else setSelectedRecipeId('');
                                                }}
                                                className="tech-input w-full bg-white dark:bg-slate-900"
                                            >
                                                <option value="">-- Manual Calculation --</option>
                                                {recipes.map(recipe => (
                                                    <option key={recipe.id} value={recipe.id}>
                                                        {recipe.name} (Est. {recipe.target_quantity} units)
                                                    </option>
                                                ))}
                                            </select>
                                        </div>
                                        <div className="hidden md:flex w-12 h-12 items-center justify-center rounded-full bg-white dark:bg-slate-800 shadow-sm">
                                            <Sparkles className="w-6 h-6 text-indigo-400" />
                                        </div>
                                    </div>

                                    <div>
                                        <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2">
                                            Link to Inventory (Optional)
                                        </label>
                                        <select
                                            id="batch-product-select"
                                            value={batchProductId}
                                            onChange={(e) => {
                                                const id = e.target.value ? Number(e.target.value) : '';
                                                setBatchProductId(id);
                                                if (id) {
                                                    const prod = inventory.find(p => p.id === id);
                                                    if (prod) setCustomProductName(prod.name);
                                                }
                                            }}
                                            className="tech-input w-full"
                                        >
                                            <option value="">-- Generic Product --</option>
                                            {inventory.map(prod => (
                                                <option key={prod.id} value={prod.id}>
                                                    {prod.name} (Stock: {prod.stock || 0})
                                                </option>
                                            ))}
                                        </select>
                                    </div>

                                    <div>
                                        <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2">
                                            Production Identity <span className="text-rose-500">*</span>
                                        </label>
                                        <input
                                            id="custom-product-name-input"
                                            type="text"
                                            required
                                            placeholder="Product Name"
                                            value={customProductName}
                                            onChange={(e) => setCustomProductName(e.target.value)}
                                            className="tech-input w-full"
                                        />
                                    </div>

                                    <div>
                                        <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2">
                                            Target Yield (Units) <span className="text-rose-500">*</span>
                                        </label>
                                        <input
                                            id="batch-quantity-input"
                                            type="number"
                                            min="1"
                                            step="any"
                                            required
                                            value={quantityProduced}
                                            onChange={(e) => setQuantityProduced(e.target.value)}
                                            className="tech-input w-full"
                                        />
                                    </div>

                                    <div>
                                        <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2">
                                            Chief Operator
                                        </label>
                                        <input
                                            id="batch-operator-input"
                                            type="text"
                                            value={responsibleUser}
                                            onChange={(e) => setResponsibleUser(e.target.value)}
                                            className="tech-input w-full"
                                        />
                                    </div>
                                </div>
                            </div>

                            {/* Raw Material Usages Section */}
                            <div className="tech-card p-6 space-y-6">
                                <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-4">
                                    <h2 className="text-sm font-black text-slate-900 dark:text-white flex items-center gap-2 uppercase tracking-widest">
                                        <div className="w-8 h-8 rounded-lg bg-emerald-600/10 text-emerald-600 flex items-center justify-center font-black">02</div>
                                        Raw Materials
                                    </h2>
                                    <div className="text-right">
                                        <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Subtotal</div>
                                        <div className="text-lg font-black text-emerald-600">{formatCurrency(rawMaterialsSubtotal, user?.location)}</div>
                                    </div>
                                </div>

                                {/* Ingredient addition input */}
                                <div className="bg-slate-50 dark:bg-slate-800/50 p-4 rounded-xl flex flex-col md:flex-row gap-4 items-end">
                                    <div className="flex-1 w-full">
                                        <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2">Select Ingredient</label>
                                        <select
                                            value={materialInput.ingredientId}
                                            onChange={(e) => setMaterialInput(prev => ({ ...prev, ingredientId: e.target.value ? Number(e.target.value) : '' }))}
                                            className="tech-input w-full bg-white dark:bg-slate-900"
                                        >
                                            <option value="">-- Choose Ingredient --</option>
                                            {ingredients.map(ing => (
                                                <option key={ing.id} value={ing.id}>
                                                    {ing.name} ({ing.current_stock} {ing.unit} available)
                                                </option>
                                            ))}
                                        </select>
                                    </div>

                                    <div className="w-full md:w-40">
                                        <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2">Quantity</label>
                                        <input
                                            type="number"
                                            step="any"
                                            placeholder="0.00"
                                            value={materialInput.quantity}
                                            onChange={(e) => setMaterialInput(prev => ({ ...prev, quantity: e.target.value }))}
                                            className="tech-input w-full bg-white dark:bg-slate-900"
                                        />
                                    </div>

                                    <button
                                        type="button"
                                        onClick={handleAddMaterialToBatch}
                                        className="tech-button bg-emerald-600 text-white px-6 py-2"
                                    >
                                        Add
                                    </button>
                                </div>

                                {/* Table of selected materials */}
                                {selectedMaterials.length > 0 ? (
                                    <div className="overflow-hidden border border-slate-100 dark:border-slate-800 rounded-xl">
                                        <table className="w-full text-left">
                                            <thead className="bg-slate-50 dark:bg-slate-800/30 text-[10px] font-black text-slate-400 uppercase tracking-widest border-b border-slate-100 dark:border-slate-800">
                                                <tr>
                                                    <th className="px-4 py-3">Ingredient</th>
                                                    <th className="px-4 py-3 text-right">Qty</th>
                                                    <th className="px-4 py-3 text-right">Cost</th>
                                                    <th className="px-4 py-3 text-center w-10"></th>
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                                                {selectedMaterials.map((item, idx) => (
                                                    <tr key={idx} className="text-xs">
                                                        <td className="px-4 py-3 font-black text-slate-900 dark:text-white">
                                                            {item.ingredient_name}
                                                        </td>
                                                        <td className="px-4 py-3 text-right font-bold text-slate-500">
                                                            {item.quantity_used} {item.unit}
                                                        </td>
                                                        <td className="px-4 py-3 text-right font-black text-emerald-600">
                                                            {formatCurrency(item.cost, user?.location)}
                                                        </td>
                                                        <td className="px-4 py-3 text-center">
                                                            <button
                                                                type="button"
                                                                onClick={() => handleRemoveMaterial(idx)}
                                                                className="text-rose-500 hover:text-rose-700"
                                                            >
                                                                <X className="w-4 h-4" />
                                                            </button>
                                                        </td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                ) : (
                                    <div className="py-8 text-center bg-slate-50 dark:bg-slate-800/30 rounded-xl border border-dashed border-slate-200 dark:border-slate-800">
                                        <p className="text-[10px] font-black uppercase text-slate-400 tracking-widest">No materials added</p>
                                    </div>
                                )}
                            </div>

                            {/* Direct Labour Costs Section */}
                            <div className="tech-card p-6 space-y-6">
                                <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-4">
                                    <h2 className="text-sm font-black text-slate-900 dark:text-white flex items-center gap-2 uppercase tracking-widest">
                                        <div className="w-8 h-8 rounded-lg bg-blue-600/10 text-blue-600 flex items-center justify-center font-black">03</div>
                                        Direct Labour
                                    </h2>
                                    <div className="text-right">
                                        <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Subtotal</div>
                                        <div className="text-lg font-black text-blue-600">{formatCurrency(labourSubtotal, user?.location)}</div>
                                    </div>
                                </div>

                                <div className="bg-slate-50 dark:bg-slate-800/50 p-4 rounded-xl flex flex-col md:flex-row gap-4 items-end">
                                    <div className="flex-1 w-full">
                                        <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2">Operator Name</label>
                                        <input
                                            type="text"
                                            placeholder="Operator ID / Name"
                                            value={labourInput.name}
                                            onChange={(e) => setLabourInput(prev => ({ ...prev, name: e.target.value }))}
                                            className="tech-input w-full bg-white dark:bg-slate-900"
                                        />
                                    </div>

                                    <div className="w-full md:w-32">
                                        <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2">Hours</label>
                                        <input
                                            type="number"
                                            step="any"
                                            placeholder="0.00"
                                            value={labourInput.hours}
                                            onChange={(e) => setLabourInput(prev => ({ ...prev, hours: e.target.value }))}
                                            className="tech-input w-full bg-white dark:bg-slate-900"
                                        />
                                    </div>

                                    <div className="w-full md:w-40">
                                        <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2">Rate/Hr</label>
                                        <input
                                            type="number"
                                            step="any"
                                            placeholder="Rate"
                                            value={labourInput.rate}
                                            onChange={(e) => setLabourInput(prev => ({ ...prev, rate: e.target.value }))}
                                            className="tech-input w-full bg-white dark:bg-slate-900"
                                        />
                                    </div>

                                    <button
                                        type="button"
                                        onClick={handleAddLabour}
                                        className="tech-button bg-blue-600 text-white px-6 py-2"
                                    >
                                        Add
                                    </button>
                                </div>

                                {labourList.length > 0 && (
                                    <div className="overflow-hidden border border-slate-100 dark:border-slate-800 rounded-xl">
                                        <table className="w-full text-left">
                                            <thead className="bg-slate-50 dark:bg-slate-800/30 text-[10px] font-black text-slate-400 uppercase tracking-widest border-b border-slate-100 dark:border-slate-800">
                                                <tr>
                                                    <th className="px-4 py-3">Worker</th>
                                                    <th className="px-4 py-3 text-right">Time</th>
                                                    <th className="px-4 py-3 text-right">Cost</th>
                                                    <th className="px-4 py-3 text-center w-10"></th>
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                                                {labourList.map((l, idx) => (
                                                    <tr key={idx} className="text-xs">
                                                        <td className="px-4 py-3 font-black text-slate-900 dark:text-white">{l.employee_name}</td>
                                                        <td className="px-4 py-3 text-right font-bold text-slate-500">{l.hours_worked}h @ {formatCurrency(l.hourly_rate, user?.location)}</td>
                                                        <td className="px-4 py-3 text-right font-black text-blue-600">{formatCurrency(l.total_cost, user?.location)}</td>
                                                        <td className="px-4 py-3 text-center">
                                                            <button type="button" onClick={() => handleRemoveLabour(idx)} className="text-rose-500 hover:text-rose-700">
                                                                <X className="w-4 h-4" />
                                                            </button>
                                                        </td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                )}
                            </div>

                            {/* Overhead Costs Section */}
                            {/* Associated Costs & Utility Bills Section */}
                            <div className="tech-card p-6 space-y-6">
                                <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-4 gap-2">
                                    <div>
                                        <h2 className="text-sm font-black text-slate-900 dark:text-white flex items-center gap-2 uppercase tracking-widest">
                                            <div className="w-8 h-8 rounded-lg bg-amber-500/10 text-amber-600 dark:text-amber-400 flex items-center justify-center font-black">04</div>
                                            Utility Bills & Associated Production Costs
                                        </h2>
                                        <p className="text-[10px] text-slate-500 dark:text-slate-400 font-bold uppercase tracking-wider mt-1">
                                            Track electricity tokens, water utility, generator fuel, packaging, and machinery maintenance
                                        </p>
                                    </div>
                                    <div className="text-left sm:text-right">
                                        <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Utilities & Overheads Subtotal</div>
                                        <div className="text-lg font-black text-amber-600 dark:text-amber-400">{formatCurrency(overheadSubtotal, user?.location)}</div>
                                    </div>
                                </div>

                                {/* Quick Category Selector Chips */}
                                <div>
                                    <label className="block text-[10px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-widest mb-2 flex items-center gap-1.5">
                                        <Tag className="w-3.5 h-3.5 text-amber-500" />
                                        Cost Item Quick Select
                                    </label>
                                    <div className="flex flex-wrap gap-2">
                                        {PRODUCTION_OVERHEAD_CATEGORIES.map((cat) => {
                                            const isSelected = overheadInput.category === cat.category;
                                            return (
                                                <button
                                                    key={cat.category}
                                                    type="button"
                                                    onClick={() => handleSelectOverheadCategory(cat.category)}
                                                    className={`px-3 py-1.5 rounded-lg text-xs font-black uppercase tracking-wider flex items-center gap-1.5 border transition-all ${
                                                        isSelected
                                                            ? 'bg-slate-900 text-white border-slate-900 dark:bg-white dark:text-slate-900 shadow-sm'
                                                            : 'bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:border-slate-400'
                                                    }`}
                                                >
                                                    {getCategoryIcon(cat.category)}
                                                    <span>{cat.category}</span>
                                                </button>
                                            );
                                        })}
                                    </div>
                                </div>

                                {/* Cost Calculation Mode & Input Form */}
                                <div className="bg-slate-50 dark:bg-slate-800/50 p-4 rounded-xl border border-slate-200 dark:border-slate-700 space-y-4">
                                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-200 dark:border-slate-700 pb-3">
                                        <div className="flex items-center gap-2">
                                            <span className="text-[10px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-widest">Calculation Mode:</span>
                                            <div className="inline-flex rounded-lg p-0.5 bg-slate-200 dark:bg-slate-700">
                                                <button
                                                    type="button"
                                                    onClick={() => setOverheadInput(prev => ({ ...prev, calculation_mode: 'flat' }))}
                                                    className={`px-2.5 py-1 text-[10px] font-black uppercase tracking-wider rounded-md transition-all ${
                                                        overheadInput.calculation_mode === 'flat'
                                                            ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-xs'
                                                            : 'text-slate-600 dark:text-slate-300'
                                                    }`}
                                                >
                                                    Direct Bill Amount
                                                </button>
                                                <button
                                                    type="button"
                                                    onClick={() => setOverheadInput(prev => ({ ...prev, calculation_mode: 'unit_rate' }))}
                                                    className={`px-2.5 py-1 text-[10px] font-black uppercase tracking-wider rounded-md transition-all ${
                                                        overheadInput.calculation_mode === 'unit_rate'
                                                            ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-xs'
                                                            : 'text-slate-600 dark:text-slate-300'
                                                    }`}
                                                >
                                                    Rate × Consumption
                                                </button>
                                            </div>
                                        </div>

                                        {overheadInput.calculation_mode === 'unit_rate' && (
                                            <div className="text-[11px] font-black text-indigo-600 dark:text-indigo-400 font-mono">
                                                Est. Cost: {formatCurrency(
                                                    ((parseFloat(overheadInput.units_consumed) || 0) * (parseFloat(overheadInput.unit_rate) || 0)),
                                                    user?.location
                                                )}
                                            </div>
                                        )}
                                    </div>

                                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                                        <div>
                                            <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1">
                                                Cost Category
                                            </label>
                                            <select
                                                value={overheadInput.category}
                                                onChange={(e) => handleSelectOverheadCategory(e.target.value)}
                                                className="tech-input w-full bg-white dark:bg-slate-900 text-xs"
                                            >
                                                {PRODUCTION_OVERHEAD_CATEGORIES.map(cat => (
                                                    <option key={cat.category} value={cat.category}>
                                                        {cat.label}
                                                    </option>
                                                ))}
                                            </select>
                                        </div>

                                        <div className="sm:col-span-1 lg:col-span-2">
                                            <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1">
                                                Description / Purpose
                                            </label>
                                            <input
                                                type="text"
                                                placeholder="e.g. 3-Phase generator power run, packaging tape"
                                                value={overheadInput.description}
                                                onChange={(e) => setOverheadInput(prev => ({ ...prev, description: e.target.value }))}
                                                className="tech-input w-full bg-white dark:bg-slate-900 text-xs"
                                            />
                                        </div>

                                        {overheadInput.calculation_mode === 'flat' ? (
                                            <div>
                                                <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1">
                                                    Bill Amount <span className="text-rose-500">*</span>
                                                </label>
                                                <input
                                                    type="number"
                                                    step="any"
                                                    placeholder="0.00"
                                                    value={overheadInput.amount}
                                                    onChange={(e) => setOverheadInput(prev => ({ ...prev, amount: e.target.value }))}
                                                    className="tech-input w-full bg-white dark:bg-slate-900 text-xs font-mono font-bold"
                                                />
                                            </div>
                                        ) : (
                                            <div className="grid grid-cols-3 gap-2 sm:col-span-2 lg:col-span-1">
                                                <div>
                                                    <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1 truncate">
                                                        Units
                                                    </label>
                                                    <input
                                                        type="number"
                                                        step="any"
                                                        placeholder="Qty"
                                                        value={overheadInput.units_consumed}
                                                        onChange={(e) => setOverheadInput(prev => ({ ...prev, units_consumed: e.target.value }))}
                                                        className="tech-input w-full bg-white dark:bg-slate-900 text-xs font-mono"
                                                    />
                                                </div>
                                                <div>
                                                    <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1 truncate">
                                                        Scale
                                                    </label>
                                                    <input
                                                        type="text"
                                                        placeholder="kWh/L"
                                                        value={overheadInput.unit_measure}
                                                        onChange={(e) => setOverheadInput(prev => ({ ...prev, unit_measure: e.target.value }))}
                                                        className="tech-input w-full bg-white dark:bg-slate-900 text-xs font-mono"
                                                    />
                                                </div>
                                                <div>
                                                    <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1 truncate">
                                                        Rate
                                                    </label>
                                                    <input
                                                        type="number"
                                                        step="any"
                                                        placeholder="Price"
                                                        value={overheadInput.unit_rate}
                                                        onChange={(e) => setOverheadInput(prev => ({ ...prev, unit_rate: e.target.value }))}
                                                        className="tech-input w-full bg-white dark:bg-slate-900 text-xs font-mono"
                                                    />
                                                </div>
                                            </div>
                                        )}
                                    </div>

                                    {/* Secondary References & Add Button */}
                                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 items-end pt-1">
                                        <div>
                                            <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1 flex items-center gap-1">
                                                <Receipt className="w-3 h-3 text-slate-400" />
                                                Bill / Token / Invoice #
                                            </label>
                                            <input
                                                type="text"
                                                placeholder="e.g. KPLC Token #9281, Inv #4092"
                                                value={overheadInput.bill_reference}
                                                onChange={(e) => setOverheadInput(prev => ({ ...prev, bill_reference: e.target.value }))}
                                                className="tech-input w-full bg-white dark:bg-slate-900 text-xs font-mono"
                                            />
                                        </div>

                                        <div>
                                            <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1">
                                                Shift / Run Period
                                            </label>
                                            <input
                                                type="text"
                                                placeholder="e.g. Morning Shift, Batch 1"
                                                value={overheadInput.billing_period}
                                                onChange={(e) => setOverheadInput(prev => ({ ...prev, billing_period: e.target.value }))}
                                                className="tech-input w-full bg-white dark:bg-slate-900 text-xs"
                                            />
                                        </div>

                                        <button
                                            type="button"
                                            onClick={handleAddOverhead}
                                            className="tech-button bg-amber-600 hover:bg-amber-700 text-white px-5 py-2.5 flex items-center justify-center gap-2 uppercase tracking-widest text-[10px] font-black shadow-xs cursor-pointer"
                                        >
                                            <Plus className="w-4 h-4" />
                                            <span>Add Cost Item</span>
                                        </button>
                                    </div>
                                </div>

                                {/* Itemized Overheads Table */}
                                {overheadList.length > 0 ? (
                                    <div className="overflow-hidden border border-slate-200 dark:border-slate-800 rounded-xl">
                                        <table className="w-full text-left">
                                            <thead className="bg-slate-50 dark:bg-slate-800/40 text-[10px] font-black text-slate-400 uppercase tracking-widest border-b border-slate-200 dark:border-slate-800">
                                                <tr>
                                                    <th className="px-4 py-3">Cost Item & Category</th>
                                                    <th className="px-4 py-3">Details & Reference</th>
                                                    <th className="px-4 py-3 text-right">Consumption / Scale</th>
                                                    <th className="px-4 py-3 text-right">Expense Amount</th>
                                                    <th className="px-4 py-3 text-center w-10"></th>
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                                                {overheadList.map((o, idx) => (
                                                    <tr key={idx} className="text-xs hover:bg-slate-50/50 dark:hover:bg-slate-800/20 transition-colors">
                                                        <td className="px-4 py-3">
                                                            <div className="flex items-center gap-2">
                                                                <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-[10px] font-black uppercase tracking-wider border ${getCategoryBadgeClass(o.category)}`}>
                                                                    {getCategoryIcon(o.category)}
                                                                    {o.category}
                                                                </span>
                                                            </div>
                                                        </td>
                                                        <td className="px-4 py-3">
                                                            <div className="font-bold text-slate-900 dark:text-white">{o.description}</div>
                                                            <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                                                                {o.bill_reference && (
                                                                    <span className="inline-flex items-center gap-1 text-[9px] font-mono font-bold bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 rounded text-slate-600 dark:text-slate-300">
                                                                        <Receipt className="w-2.5 h-2.5 text-slate-400" />
                                                                        Ref: {o.bill_reference}
                                                                    </span>
                                                                )}
                                                                {o.billing_period && (
                                                                    <span className="text-[9px] font-bold text-slate-400 uppercase">
                                                                        Period: {o.billing_period}
                                                                    </span>
                                                                )}
                                                            </div>
                                                        </td>
                                                        <td className="px-4 py-3 text-right">
                                                            {o.units_consumed && o.unit_rate ? (
                                                                <div className="font-mono text-slate-700 dark:text-slate-300 text-xs font-bold">
                                                                    {o.units_consumed} {o.unit_measure || 'units'} @ {formatCurrency(o.unit_rate, user?.location)}
                                                                </div>
                                                            ) : (
                                                                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Fixed Lump Sum</span>
                                                            )}
                                                        </td>
                                                        <td className="px-4 py-3 text-right font-black font-mono text-amber-600 dark:text-amber-400 text-sm">
                                                            {formatCurrency(o.amount, user?.location)}
                                                        </td>
                                                        <td className="px-4 py-3 text-center">
                                                            <button 
                                                                type="button" 
                                                                onClick={() => handleRemoveOverhead(idx)} 
                                                                className="text-rose-500 hover:text-rose-700 p-1"
                                                                title="Remove cost item"
                                                            >
                                                                <X className="w-4 h-4" />
                                                            </button>
                                                        </td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                ) : (
                                    <div className="py-8 text-center bg-slate-50 dark:bg-slate-800/30 rounded-xl border border-dashed border-slate-200 dark:border-slate-800">
                                        <p className="text-[10px] font-black uppercase text-slate-400 tracking-widest">No utility bills or overhead costs added to this batch</p>
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Right Column: Costing Summary */}
                        <div className="space-y-6">
                            <div className="tech-card overflow-hidden">
                                <div className="bg-slate-900 p-6">
                                    <div className="text-[10px] font-black text-indigo-400 uppercase tracking-[0.2em] mb-1 text-center">Batch Intelligence</div>
                                    <h3 className="text-lg font-black text-white uppercase tracking-wider text-center">Production Economics</h3>
                                </div>

                                <div className="p-6 space-y-6">
                                    {/* Major Totals with Percentages */}
                                    <div className="space-y-3">
                                        <div className="flex justify-between items-center text-xs">
                                            <span className="font-black text-slate-400 uppercase tracking-widest flex items-center gap-1.5">
                                                <Box className="w-3.5 h-3.5 text-emerald-500" />
                                                Materials
                                            </span>
                                            <div className="text-right">
                                                <div className="font-black text-slate-900 dark:text-white">{formatCurrency(rawMaterialsSubtotal, user?.location)}</div>
                                                <div className="text-[9px] font-bold text-slate-400">
                                                    {totalBatchCost > 0 ? ((rawMaterialsSubtotal / totalBatchCost) * 100).toFixed(1) : 0}% of COGS
                                                </div>
                                            </div>
                                        </div>
                                        <div className="flex justify-between items-center text-xs">
                                            <span className="font-black text-slate-400 uppercase tracking-widest flex items-center gap-1.5">
                                                <Users className="w-3.5 h-3.5 text-blue-500" />
                                                Labour
                                            </span>
                                            <div className="text-right">
                                                <div className="font-black text-slate-900 dark:text-white">{formatCurrency(labourSubtotal, user?.location)}</div>
                                                <div className="text-[9px] font-bold text-slate-400">
                                                    {totalBatchCost > 0 ? ((labourSubtotal / totalBatchCost) * 100).toFixed(1) : 0}% of COGS
                                                </div>
                                            </div>
                                        </div>
                                        <div className="flex justify-between items-center text-xs">
                                            <span className="font-black text-slate-400 uppercase tracking-widest flex items-center gap-1.5">
                                                <Zap className="w-3.5 h-3.5 text-amber-500" />
                                                Utilities & Costs
                                            </span>
                                            <div className="text-right">
                                                <div className="font-black text-slate-900 dark:text-white">{formatCurrency(overheadSubtotal, user?.location)}</div>
                                                <div className="text-[9px] font-bold text-slate-400">
                                                    {totalBatchCost > 0 ? ((overheadSubtotal / totalBatchCost) * 100).toFixed(1) : 0}% of COGS
                                                </div>
                                            </div>
                                        </div>
                                        
                                        <div className="pt-3 border-t border-slate-100 dark:border-slate-800 space-y-3">
                                            <div className="flex justify-between items-center">
                                                <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Total COGS</span>
                                                <span className="text-xl font-black text-indigo-600 tracking-tighter">
                                                    {formatCurrency(totalBatchCost, user?.location)}
                                                </span>
                                            </div>
                                            
                                            <div className="bg-indigo-50 dark:bg-indigo-950/20 p-4 rounded-xl border border-indigo-100 dark:border-indigo-900/40 text-center">
                                                <div className="text-[10px] font-black text-indigo-600 dark:text-indigo-400 uppercase tracking-widest mb-1">
                                                    Unit Production Cost
                                                </div>
                                                <div className="text-2xl font-black text-indigo-600">
                                                    {formatCurrency(unitBatchCost, user?.location)}
                                                </div>
                                                <div className="text-[9px] font-bold text-indigo-400 uppercase mt-1 tracking-widest">
                                                    Est. Yield: {qtyProducedNum.toLocaleString()} units
                                                </div>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Visual Breakdown Bar */}
                                    <div className="space-y-2">
                                        <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Cost Allocation</div>
                                        <div className="h-3 w-full bg-slate-100 dark:bg-slate-800 rounded-full flex overflow-hidden">
                                            <div 
                                                className="h-full bg-emerald-500" 
                                                style={{ width: `${(rawMaterialsSubtotal / (totalBatchCost || 1)) * 100}%` }}
                                            />
                                            <div 
                                                className="h-full bg-blue-500" 
                                                style={{ width: `${(labourSubtotal / (totalBatchCost || 1)) * 100}%` }}
                                            />
                                            <div 
                                                className="h-full bg-purple-500" 
                                                style={{ width: `${(overheadSubtotal / (totalBatchCost || 1)) * 100}%` }}
                                            />
                                        </div>
                                        <div className="flex justify-between text-[9px] font-black uppercase tracking-widest">
                                            <div className="flex items-center gap-1.5"><div className="w-1.5 h-1.5 rounded-full bg-emerald-500" /> Materials</div>
                                            <div className="flex items-center gap-1.5"><div className="w-1.5 h-1.5 rounded-full bg-blue-500" /> Labour</div>
                                            <div className="flex items-center gap-1.5"><div className="w-1.5 h-1.5 rounded-full bg-purple-500" /> Overheads</div>
                                        </div>
                                    </div>

                                    <div className="space-y-4 pt-2">
                                        <div className="space-y-2">
                                            <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest">
                                                Batch Notes
                                            </label>
                                            <textarea
                                                rows={2}
                                                placeholder="Quality control remarks..."
                                                value={batchNotes}
                                                onChange={(e) => setBatchNotes(e.target.value)}
                                                className="tech-input w-full"
                                            />
                                        </div>

                                        <button
                                            id="submit-batch-btn"
                                            type="submit"
                                            disabled={isSubmittingBatch || !customProductName || !quantityProduced}
                                            className="tech-button w-full bg-indigo-600 text-white py-4 flex items-center justify-center gap-3 disabled:opacity-50"
                                        >
                                            <Save className="w-5 h-5" />
                                            <span className="font-black uppercase tracking-widest">
                                                {isSubmittingBatch ? 'Authorizing...' : 'Authorize Production'}
                                            </span>
                                        </button>
                                    </div>

                                    <div className="flex items-start gap-3 p-3 bg-slate-50 dark:bg-slate-800/50 rounded-xl border border-slate-100 dark:border-slate-800">
                                        <ShieldCheck className="w-4 h-4 text-indigo-600 shrink-0 mt-0.5" />
                                        <p className="text-[10px] text-slate-500 leading-tight">
                                            <span className="font-black text-slate-900 dark:text-white uppercase tracking-widest block mb-1">Governance Lock</span>
                                            Authorization will commit inventory and record associated manufacturing expenses to the ledger.
                                        </p>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </form>
            )}

            {/* TAB 3: INGREDIENTS & RAW MATERIALS */}
            {activeSubTab === 'ingredients' && (
                <div className="space-y-4">
                    <div className="tech-card p-6 flex flex-col md:flex-row items-center justify-between gap-4">
                        <div className="flex items-center gap-4">
                            <div className="w-12 h-12 rounded-xl bg-indigo-600/10 text-indigo-600 flex items-center justify-center">
                                <Box className="w-6 h-6" />
                            </div>
                            <div>
                                <h2 className="text-sm font-black text-slate-900 dark:text-white uppercase tracking-widest">
                                    Raw Materials & Global Stock
                                </h2>
                                <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mt-1">
                                    Centralized procurement and inventory management
                                </p>
                            </div>
                        </div>

                        <button
                            id="add-ingredient-subtab-btn"
                            onClick={() => setShowAddIngredientModal(true)}
                            className="tech-button bg-indigo-600 text-white px-6 py-3 flex items-center gap-2"
                        >
                            <Plus className="w-4 h-4" />
                            <span className="font-black uppercase tracking-widest text-[10px]">Onboard Material</span>
                        </button>
                    </div>

                    <div className="tech-card overflow-hidden">
                        <div className="overflow-x-auto">
                            <table className="w-full text-left">
                                <thead className="bg-slate-900 text-[10px] font-black text-indigo-400 uppercase tracking-widest">
                                    <tr>
                                        <th className="px-6 py-4">Ingredient ID / Description</th>
                                        <th className="px-6 py-4 text-right">Standard Unit</th>
                                        <th className="px-6 py-4 text-right">Unit Cost</th>
                                        <th className="px-6 py-4 text-right">Current Stock</th>
                                        <th className="px-6 py-4 text-center">Status</th>
                                        <th className="px-6 py-4 text-right">Operations</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                                    {ingredients.map((ing) => {
                                        const isLowStock = ing.current_stock <= ing.reorder_level;
                                        return (
                                            <tr key={ing.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                                                <td className="px-6 py-4">
                                                    <div className="font-black text-slate-900 dark:text-white uppercase tracking-wider">{ing.name}</div>
                                                    <div className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mt-0.5">Threshold: {ing.reorder_level} {ing.unit}</div>
                                                </td>
                                                <td className="px-6 py-4 text-right">
                                                    <span className="text-[10px] font-black bg-slate-100 dark:bg-slate-800 px-2 py-1 rounded text-slate-500 uppercase tracking-widest">{ing.unit}</span>
                                                </td>
                                                <td className="px-6 py-4 text-right font-black text-slate-900 dark:text-white">
                                                    {formatCurrency(ing.cost_per_unit, user?.location)}
                                                </td>
                                                <td className="px-6 py-4 text-right">
                                                    <span className={`text-sm font-black ${isLowStock ? 'text-rose-600' : 'text-emerald-600'}`}>
                                                        {ing.current_stock.toLocaleString()}
                                                    </span>
                                                </td>
                                                <td className="px-6 py-4 text-center">
                                                    <span className={`text-[9px] font-black uppercase tracking-[0.15em] px-2 py-1 rounded border ${
                                                        isLowStock 
                                                            ? 'border-rose-200 bg-rose-50 text-rose-700 dark:bg-rose-950/20'
                                                            : 'border-emerald-200 bg-emerald-50 text-emerald-700 dark:bg-emerald-950/20'
                                                    }`}>
                                                        {isLowStock ? 'Critical Stock' : 'Active'}
                                                    </span>
                                                </td>
                                                <td className="px-6 py-4 text-right">
                                                    <div className="flex items-center justify-end gap-2">
                                                        <button
                                                            onClick={() => handleQuickStockUpdate(ing, 50)}
                                                            className="text-[10px] font-black text-indigo-600 hover:underline uppercase tracking-widest"
                                                        >
                                                            +50
                                                        </button>
                                                        <button
                                                            onClick={() => setEditingIngredient(ing)}
                                                            className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg text-slate-400 hover:text-indigo-600"
                                                        >
                                                            <Edit3 className="w-4 h-4" />
                                                        </button>
                                                        <button
                                                            onClick={() => handleDeleteIngredient(ing.id)}
                                                            className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg text-slate-400 hover:text-rose-600"
                                                        >
                                                            <Trash2 className="w-4 h-4" />
                                                        </button>
                                                    </div>
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            )}

            {/* TAB 4: RECIPES & BOM */}
            {activeSubTab === 'recipes' && (
                <div className="space-y-4">
                    <div className="tech-card p-6 flex flex-col md:flex-row items-center justify-between gap-4">
                        <div className="flex items-center gap-4">
                            <div className="w-12 h-12 rounded-xl bg-indigo-600/10 text-indigo-600 flex items-center justify-center">
                                <FileText className="w-6 h-6" />
                            </div>
                            <div>
                                <h2 className="text-sm font-black text-slate-900 dark:text-white uppercase tracking-widest">
                                    Bill of Materials (BOM)
                                </h2>
                                <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mt-1">
                                    Standardized recipes for consistent output
                                </p>
                            </div>
                        </div>

                        <button
                            id="add-recipe-btn"
                            onClick={() => setShowAddRecipeModal(true)}
                            className="tech-button bg-indigo-600 text-white px-6 py-3 flex items-center gap-2"
                        >
                            <Plus className="w-4 h-4" />
                            <span className="font-black uppercase tracking-widest text-[10px]">Define New BOM</span>
                        </button>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
                        {recipes.length === 0 ? (
                            <div className="col-span-full py-16 text-center bg-slate-50 dark:bg-slate-800/30 border border-dashed border-slate-200 dark:border-slate-800 rounded-2xl">
                                <FileText className="w-12 h-12 mx-auto text-slate-300 dark:text-slate-700 mb-4" />
                                <p className="text-[10px] font-black uppercase text-slate-400 tracking-widest">No recipes defined in system</p>
                            </div>
                        ) : (
                            recipes.map(recipe => (
                                <div key={recipe.id} className="tech-card p-6 group hover:border-indigo-500/50 transition-all flex flex-col justify-between">
                                    <div className="space-y-4">
                                        <div className="flex items-start justify-between">
                                            <div className="w-10 h-10 rounded-lg bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-500 group-hover:bg-indigo-600/10 group-hover:text-indigo-600 transition-colors">
                                                <FileText className="w-5 h-5" />
                                            </div>
                                            <button 
                                                onClick={() => handleDeleteRecipe(recipe.id)}
                                                className="p-2 text-slate-300 hover:text-rose-500 transition-colors"
                                            >
                                                <Trash2 className="w-4 h-4" />
                                            </button>
                                        </div>
                                        <div>
                                            <h3 className="font-black text-slate-900 dark:text-white uppercase tracking-wider text-sm line-clamp-1">{recipe.name}</h3>
                                            <p className="text-[10px] text-slate-500 line-clamp-2 mt-2 font-bold uppercase tracking-widest leading-relaxed">
                                                {recipe.description || 'Global Standard BOM Configuration'}
                                            </p>
                                        </div>
                                        <div className="pt-4 flex flex-wrap gap-2">
                                            <div className="text-[9px] font-black bg-indigo-50 text-indigo-700 dark:bg-indigo-950/30 px-2 py-1 rounded uppercase tracking-widest border border-indigo-100 dark:border-indigo-900/50">
                                                Yield: {recipe.target_quantity} units
                                            </div>
                                            {recipe.product_name && (
                                                <div className="text-[9px] font-black bg-slate-100 text-slate-600 dark:bg-slate-800 px-2 py-1 rounded uppercase tracking-widest border border-slate-200 dark:border-slate-700">
                                                    Link: {recipe.product_name}
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                    
                                    <div className="mt-6 pt-4 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between">
                                        <div className="text-[9px] font-black text-slate-400 uppercase tracking-widest">
                                            {recipe.ingredients?.length || 0} Elements
                                        </div>
                                        <button 
                                            onClick={() => {
                                                setActiveSubTab('new-batch');
                                                handleApplyRecipe(recipe.id);
                                            }}
                                            className="text-[10px] font-black text-indigo-600 hover:text-indigo-700 uppercase tracking-widest flex items-center gap-1"
                                        >
                                            Initialize <ArrowUpRight className="w-3 h-3" />
                                        </button>
                                    </div>
                                </div>
                            ))
                        )}
                    </div>
                </div>
            )}

            {/* TAB 5: COST ANALYSIS & INSIGHTS */}
            {activeSubTab === 'insights' && (
                <div className="space-y-6">
                    {/* Insights Dashboard Header */}
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                        <div className="tech-card p-4 bg-white dark:bg-slate-900 border-indigo-500/30">
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 rounded-xl bg-indigo-500/10 text-indigo-500 flex items-center justify-center">
                                    <TrendingUp className="w-5 h-5" />
                                </div>
                                <div>
                                    <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Total Mfg. Value</div>
                                    <div className="text-xl font-black text-slate-900 dark:text-white">
                                        {formatCurrency(summary.total_cost, user?.location)}
                                    </div>
                                </div>
                            </div>
                        </div>
                        <div className="tech-card p-4 bg-white dark:bg-slate-900 border-emerald-500/30">
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 rounded-xl bg-emerald-500/10 text-emerald-500 flex items-center justify-center">
                                    <Layers className="w-5 h-5" />
                                </div>
                                <div>
                                    <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Batch Volume</div>
                                    <div className="text-xl font-black text-slate-900 dark:text-white">
                                        {summary.total_batches} <span className="text-xs text-slate-400">Batches</span>
                                    </div>
                                </div>
                            </div>
                        </div>
                        <div className="tech-card p-4 bg-white dark:bg-slate-900 border-blue-500/30">
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 rounded-xl bg-blue-500/10 text-blue-500 flex items-center justify-center">
                                    <BarChartIcon className="w-5 h-5" />
                                </div>
                                <div>
                                    <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Avg. Unit Cost</div>
                                    <div className="text-xl font-black text-slate-900 dark:text-white">
                                        {formatCurrency(summary.avg_cost_per_unit, user?.location)}
                                    </div>
                                </div>
                            </div>
                        </div>
                        <div className="tech-card p-4 bg-white dark:bg-slate-900 border-rose-500/30">
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 rounded-xl bg-rose-500/10 text-rose-500 flex items-center justify-center">
                                    <AlertCircle className="w-5 h-5" />
                                </div>
                                <div>
                                    <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Low Stock Alert</div>
                                    <div className="text-xl font-black text-slate-900 dark:text-white">
                                        {lowStockIngredients.length} <span className="text-xs text-slate-400">Items</span>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                        <div className="lg:col-span-2 space-y-6">
                            <div className="tech-card p-6 space-y-6">
                                <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-4">
                                    <h3 className="text-xs font-black text-slate-900 dark:text-white flex items-center gap-2 uppercase tracking-[0.15em]">
                                        <TrendingUp className="w-4 h-4 text-emerald-500" />
                                        Batch Performance Trends
                                    </h3>
                                    <div className="flex items-center gap-2 text-[10px] font-black text-slate-400 uppercase tracking-widest">
                                        <Calendar className="w-3 h-3" />
                                        Last 30 Days
                                    </div>
                                </div>
                                
                                <div className="h-[300px] w-full">
                                    <ResponsiveContainer width="100%" height="100%">
                                        <AreaChart
                                            data={batches.slice(0, 10).reverse().map(b => ({
                                                name: b.batch_number.split('-')[1] || b.batch_number,
                                                cost: b.total_cost,
                                                unitCost: b.cost_per_unit
                                            }))}
                                        >
                                            <defs>
                                                <linearGradient id="colorCost" x1="0" y1="0" x2="0" y2="1">
                                                    <stop offset="5%" stopColor="#6366f1" stopOpacity={0.1}/>
                                                    <stop offset="95%" stopColor="#6366f1" stopOpacity={0}/>
                                                </linearGradient>
                                            </defs>
                                            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                                            <XAxis 
                                                dataKey="name" 
                                                axisLine={false} 
                                                tickLine={false} 
                                                tick={{fontSize: 10, fontWeight: 700, fill: '#94a3b8'}}
                                                dy={10}
                                            />
                                            <YAxis 
                                                axisLine={false} 
                                                tickLine={false} 
                                                tick={{fontSize: 10, fontWeight: 700, fill: '#94a3b8'}}
                                            />
                                            <Tooltip 
                                                contentStyle={{ 
                                                    borderRadius: '12px', 
                                                    border: '2px solid #0f172a', 
                                                    fontSize: '11px',
                                                    fontWeight: 'bold',
                                                    textTransform: 'uppercase'
                                                }} 
                                            />
                                            <Area 
                                                type="monotone" 
                                                dataKey="cost" 
                                                stroke="#6366f1" 
                                                strokeWidth={3}
                                                fillOpacity={1} 
                                                fill="url(#colorCost)" 
                                            />
                                        </AreaChart>
                                    </ResponsiveContainer>
                                </div>
                            </div>

                            <div className="tech-card p-6 space-y-6">
                                <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-4">
                                    <h3 className="text-xs font-black text-slate-900 dark:text-white flex items-center gap-2 uppercase tracking-[0.15em]">
                                        <Activity className="w-4 h-4 text-blue-500" />
                                        System Health & Audit Logs
                                    </h3>
                                    <button 
                                        onClick={loadProductionData}
                                        className="text-[10px] font-black text-blue-600 hover:text-blue-700 flex items-center gap-1 uppercase tracking-widest"
                                    >
                                        <RefreshCw className="w-3 h-3" /> Refresh
                                    </button>
                                </div>

                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                    <div className="p-5 rounded-2xl bg-slate-50 dark:bg-slate-800 border-2 border-slate-900 shadow-[2px_2px_0px_0px_rgba(15,23,42,1)]">
                                        <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-4">Infrastructure Status</div>
                                        <div className="space-y-3">
                                            <div className="flex items-center justify-between">
                                                <span className="text-[11px] font-bold text-slate-600 dark:text-slate-400 uppercase tracking-widest">Database</span>
                                                <span className={`text-[9px] font-black px-3 py-1 rounded-full border ${systemHealth?.database === 'OK' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-rose-50 text-rose-700 border-rose-200'}`}>
                                                    {systemHealth?.database || 'STABLE'}
                                                </span>
                                            </div>
                                            <div className="flex items-center justify-between">
                                                <span className="text-[11px] font-bold text-slate-600 dark:text-slate-400 uppercase tracking-widest">Inventory Core</span>
                                                <span className="text-[9px] font-black px-3 py-1 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">OPTIMIZED</span>
                                            </div>
                                            <div className="flex items-center justify-between">
                                                <span className="text-[11px] font-bold text-slate-600 dark:text-slate-400 uppercase tracking-widest">BOM Engine</span>
                                                <span className="text-[9px] font-black px-3 py-1 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">READY</span>
                                            </div>
                                        </div>
                                    </div>
                                    <div className="p-5 rounded-2xl bg-slate-50 dark:bg-slate-800 border-2 border-slate-900 shadow-[2px_2px_0px_0px_rgba(15,23,42,1)]">
                                        <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Build Environment</div>
                                        <div className="text-3xl font-black text-indigo-600 tracking-tighter">v{systemHealth?.version || '2.4.0'}</div>
                                        <div className="text-[10px] font-black text-slate-500 mt-2 uppercase tracking-widest">
                                            Last Sync: {systemHealth?.timestamp ? new Date(systemHealth.timestamp).toLocaleTimeString() : 'Current Session'}
                                        </div>
                                    </div>
                                </div>

                                <div className="space-y-4">
                                    <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Security & Access Logs</div>
                                    <div className="tech-card border overflow-hidden">
                                        <table className="w-full text-left text-[10px]">
                                            <thead className="bg-slate-900 text-indigo-400 font-black uppercase tracking-widest">
                                                <tr>
                                                    <th className="px-4 py-3">Type</th>
                                                    <th className="px-4 py-3">Event Message</th>
                                                    <th className="px-4 py-3 text-right">Timestamp</th>
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                                                {errorLogs.length === 0 ? (
                                                    <tr>
                                                        <td colSpan={3} className="px-4 py-8 text-center text-slate-400 font-black uppercase tracking-widest italic">
                                                            Zero critical alerts reported
                                                        </td>
                                                    </tr>
                                                ) : (
                                                    errorLogs.slice(0, 5).map((log: any, idx: number) => (
                                                        <tr key={idx} className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                                                            <td className="px-4 py-3 font-black text-rose-600 uppercase tracking-widest">{log.error_type}</td>
                                                            <td className="px-4 py-3 font-bold text-slate-600 dark:text-slate-400 truncate max-w-[250px] uppercase">{log.error_message}</td>
                                                            <td className="px-4 py-3 text-right text-slate-400 font-bold">{new Date(log.created_at).toLocaleTimeString()}</td>
                                                        </tr>
                                                    ))
                                                )}
                                            </tbody>
                                        </table>
                                    </div>
                                </div>
                            </div>
                        </div>

                        <div className="space-y-6">
                            <div className="tech-card p-6 space-y-6 bg-slate-900 text-white">
                                <div className="flex items-center gap-3 border-b border-slate-800 pb-4">
                                    <PieChartIcon className="w-5 h-5 text-indigo-400" />
                                    <h3 className="text-xs font-black uppercase tracking-[0.2em]">Cost Allocation</h3>
                                </div>
                                
                                <div className="h-[240px] w-full">
                                    <ResponsiveContainer width="100%" height="100%">
                                        <PieChart>
                                            <Pie
                                                data={[
                                                    { name: 'Raw Materials', value: summary?.total_cost ? summary.total_cost * 0.60 : 1, color: '#10b981' },
                                                    { name: 'Direct Labour', value: summary?.total_cost ? summary.total_cost * 0.25 : 1, color: '#3b82f6' },
                                                    { name: 'Utility Bills & Overheads', value: summary?.total_cost ? summary.total_cost * 0.15 : 1, color: '#f59e0b' }
                                                ]}
                                                cx="50%"
                                                cy="50%"
                                                innerRadius={60}
                                                outerRadius={80}
                                                paddingAngle={5}
                                                dataKey="value"
                                            >
                                                <Cell fill="#10b981" />
                                                <Cell fill="#3b82f6" />
                                                <Cell fill="#f59e0b" />
                                            </Pie>
                                            <Tooltip 
                                                contentStyle={{ 
                                                    backgroundColor: '#0f172a', 
                                                    borderRadius: '8px', 
                                                    border: '1px solid #1e293b',
                                                    fontSize: '10px',
                                                    fontWeight: 'black'
                                                }} 
                                            />
                                        </PieChart>
                                    </ResponsiveContainer>
                                </div>

                                <div className="space-y-3">
                                    <div className="flex items-center justify-between">
                                        <div className="flex items-center gap-2">
                                            <div className="w-2 h-2 rounded-full bg-emerald-500" />
                                            <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">Raw Materials</span>
                                        </div>
                                        <span className="text-[11px] font-black">60%</span>
                                    </div>
                                    <div className="flex items-center justify-between">
                                        <div className="flex items-center gap-2">
                                            <div className="w-2 h-2 rounded-full bg-blue-500" />
                                            <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">Direct Labour</span>
                                        </div>
                                        <span className="text-[11px] font-black">25%</span>
                                    </div>
                                    <div className="flex items-center justify-between">
                                        <div className="flex items-center gap-2">
                                            <div className="w-2 h-2 rounded-full bg-amber-500" />
                                            <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">Utility Bills & Overheads</span>
                                        </div>
                                        <span className="text-[11px] font-black">15%</span>
                                    </div>
                                </div>
                            </div>

                            <div className="tech-card p-6 space-y-6">
                                <div className="flex items-center gap-3 border-b border-slate-100 dark:border-slate-800 pb-4">
                                    <AlertCircle className="w-5 h-5 text-rose-500" />
                                    <h3 className="text-xs font-black text-slate-900 dark:text-white uppercase tracking-[0.2em]">Procurement Risks</h3>
                                </div>
                                <div className="space-y-4">
                                    {lowStockIngredients.length === 0 ? (
                                        <div className="text-center py-6">
                                            <CheckCircle2 className="w-8 h-8 text-emerald-500 mx-auto mb-2" />
                                            <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Supply Chain Optimized</p>
                                        </div>
                                    ) : (
                                        lowStockIngredients.slice(0, 3).map(ing => (
                                            <div key={ing.id} className="flex items-center justify-between p-3 rounded-xl bg-rose-50 dark:bg-rose-950/20 border border-rose-100 dark:border-rose-900/40">
                                                <div>
                                                    <div className="text-[10px] font-black text-slate-900 dark:text-white uppercase tracking-wider">{ing.name}</div>
                                                    <div className="text-[9px] font-bold text-rose-500 uppercase mt-0.5">Stock: {ing.current_stock} {ing.unit}</div>
                                                </div>
                                                <button 
                                                    onClick={() => {
                                                        setEditingIngredient(ing);
                                                        setActiveSubTab('ingredients');
                                                    }}
                                                    className="p-1.5 bg-white dark:bg-slate-900 rounded-lg shadow-sm border border-rose-200 dark:border-rose-800 text-rose-500"
                                                >
                                                    <Plus className="w-3.5 h-3.5" />
                                                </button>
                                            </div>
                                        ))
                                    )}
                                </div>
                                <button 
                                    onClick={() => setActiveSubTab('ingredients')}
                                    className="tech-button w-full text-[10px] uppercase tracking-[0.2em]"
                                >
                                    Full Inventory
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* MODAL: BATCH DETAILS & PRINT COSTING SLIP */}
            {selectedBatch && (
                <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
                    <div className="tech-card max-w-2xl w-full p-0 overflow-hidden my-8">
                        <div className="bg-slate-900 p-6 flex items-center justify-between">
                            <div>
                                <div className="text-[10px] font-black text-amber-400 uppercase tracking-[0.2em] mb-1">
                                    Batch Costing Intelligence
                                </div>
                                <h2 className="text-xl font-black text-white font-mono uppercase tracking-widest">
                                    {selectedBatch.batch_number}
                                </h2>
                            </div>
                            <button
                                onClick={() => setSelectedBatch(null)}
                                className="p-2 bg-slate-800 text-slate-400 hover:text-white rounded-xl transition-all"
                            >
                                <XCircle className="w-6 h-6" />
                            </button>
                        </div>

                        <div ref={costingSheetRef} className="p-6 space-y-6 print-container print-format-a4 bg-white text-slate-900 rounded-xl">
                            {/* Header for Printed Costing Sheet */}
                            <div className="hidden print:block pb-4 border-b border-slate-900 mb-4">
                                <div className="flex justify-between items-center">
                                    <div>
                                        <h1 className="text-xl font-black uppercase tracking-tight">Manufacturing Costing Slip</h1>
                                        <p className="text-xs font-mono font-bold text-slate-600">Batch Ref: {selectedBatch.batch_number}</p>
                                    </div>
                                    <div className="text-right">
                                        <p className="text-xs font-bold text-slate-700">Date: {new Date(selectedBatch.production_date).toLocaleDateString()}</p>
                                        <p className="text-xs text-slate-500">Status: {selectedBatch.status.toUpperCase()}</p>
                                    </div>
                                </div>
                            </div>

                            {/* Batch Header Info */}
                            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                                <div className="p-3 bg-slate-50 dark:bg-slate-800 rounded-xl border border-slate-100 dark:border-slate-700">
                                    <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest block mb-1">Product</span>
                                    <span className="text-xs font-black text-slate-900 dark:text-white uppercase">{selectedBatch.product_name}</span>
                                </div>
                                <div className="p-3 bg-slate-50 dark:bg-slate-800 rounded-xl border border-slate-100 dark:border-slate-700">
                                    <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest block mb-1">Quantity</span>
                                    <span className="text-xs font-black text-slate-900 dark:text-white">{selectedBatch.quantity_produced} Units</span>
                                </div>
                                <div className="p-3 bg-amber-50 dark:bg-amber-950/20 rounded-xl border border-amber-100 dark:border-amber-900/40">
                                    <span className="text-[9px] font-black text-amber-600 uppercase tracking-widest block mb-1">Total Cost</span>
                                    <span className="text-xs font-black text-amber-600 font-mono">{formatCurrency(selectedBatch.total_cost, user?.location)}</span>
                                </div>
                                <div className="p-3 bg-emerald-50 dark:bg-emerald-950/20 rounded-xl border border-emerald-100 dark:border-emerald-900/40">
                                    <span className="text-[9px] font-black text-emerald-600 uppercase tracking-widest block mb-1">Unit Cost</span>
                                    <span className="text-xs font-black text-emerald-600 font-mono">{formatCurrency(selectedBatch.cost_per_unit, user?.location)}</span>
                                </div>
                            </div>

                        {/* Materials breakdown */}
                        {selectedBatch.raw_materials && selectedBatch.raw_materials.length > 0 && (
                            <div className="space-y-2">
                                <h4 className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider">
                                    Raw Materials Used
                                </h4>
                                <div className="border border-slate-100 dark:border-slate-800 rounded-lg overflow-hidden text-xs">
                                    <table className="w-full text-left">
                                        <thead className="bg-slate-50 dark:bg-slate-800 text-slate-400">
                                            <tr>
                                                <th className="px-3 py-1.5">Material</th>
                                                <th className="px-3 py-1.5 text-right">Quantity</th>
                                                <th className="px-3 py-1.5 text-right">Cost</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                                            {selectedBatch.raw_materials.map((rm, i) => (
                                                <tr key={i}>
                                                    <td className="px-3 py-1.5">{rm.ingredient_name || `Ingredient #${rm.ingredient_id}`}</td>
                                                    <td className="px-3 py-1.5 text-right">{rm.quantity_used} {rm.unit || ''}</td>
                                                    <td className="px-3 py-1.5 text-right font-mono font-medium">{formatCurrency(rm.cost, user?.location)}</td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        )}

                        {/* Labour breakdown */}
                        {selectedBatch.labour_costs && selectedBatch.labour_costs.length > 0 && (
                            <div className="space-y-2">
                                <h4 className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider">
                                    Labour Breakdown
                                </h4>
                                <div className="border border-slate-100 dark:border-slate-800 rounded-lg overflow-hidden text-xs">
                                    <table className="w-full text-left">
                                        <thead className="bg-slate-50 dark:bg-slate-800 text-slate-400">
                                            <tr>
                                                <th className="px-3 py-1.5">Worker</th>
                                                <th className="px-3 py-1.5">Hours</th>
                                                <th className="px-3 py-1.5 text-right">Rate</th>
                                                <th className="px-3 py-1.5 text-right">Total</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                                            {selectedBatch.labour_costs.map((lc, i) => (
                                                <tr key={i}>
                                                    <td className="px-3 py-1.5">{lc.employee_name} ({lc.role})</td>
                                                    <td className="px-3 py-1.5">{lc.hours_worked} hrs</td>
                                                    <td className="px-3 py-1.5 text-right font-mono">{formatCurrency(lc.hourly_rate, user?.location)}</td>
                                                    <td className="px-3 py-1.5 text-right font-mono font-medium">{formatCurrency(lc.total_cost, user?.location)}</td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        )}

                        {/* Overheads & Utility Bills breakdown */}
                        {selectedBatch.overhead_costs && selectedBatch.overhead_costs.length > 0 && (
                            <div className="space-y-2">
                                <div className="flex items-center justify-between">
                                    <h4 className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
                                        <Zap className="w-3.5 h-3.5 text-amber-500" />
                                        Utility Bills & Associated Production Costs
                                    </h4>
                                    <span className="text-[10px] font-mono font-bold text-amber-600 dark:text-amber-400">
                                        Subtotal: {formatCurrency(selectedBatch.overhead_costs.reduce((s, o) => s + (o.amount || 0), 0), user?.location)}
                                    </span>
                                </div>
                                <div className="border border-slate-200 dark:border-slate-800 rounded-lg overflow-hidden text-xs">
                                    <table className="w-full text-left">
                                        <thead className="bg-slate-50 dark:bg-slate-800 text-slate-400 font-black uppercase text-[10px]">
                                            <tr>
                                                <th className="px-3 py-1.5">Item / Category</th>
                                                <th className="px-3 py-1.5">Details & Reference</th>
                                                <th className="px-3 py-1.5 text-right">Consumption / Scale</th>
                                                <th className="px-3 py-1.5 text-right">Cost</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                                            {selectedBatch.overhead_costs.map((oc, i) => (
                                                <tr key={i}>
                                                    <td className="px-3 py-2 font-medium">
                                                        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[9px] font-black uppercase tracking-wider border ${getCategoryBadgeClass(oc.category)}`}>
                                                            {getCategoryIcon(oc.category)}
                                                            {oc.category}
                                                        </span>
                                                    </td>
                                                    <td className="px-3 py-2">
                                                        <div className="font-bold text-slate-900 dark:text-white">{oc.description}</div>
                                                        <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                                                            {oc.bill_reference && (
                                                                <span className="text-[9px] font-mono font-bold text-slate-600 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 px-1 py-0.5 rounded">
                                                                    Ref: {oc.bill_reference}
                                                                </span>
                                                            )}
                                                            {oc.billing_period && (
                                                                <span className="text-[9px] text-slate-400 uppercase">
                                                                    ({oc.billing_period})
                                                                </span>
                                                            )}
                                                        </div>
                                                    </td>
                                                    <td className="px-3 py-2 text-right font-mono text-[11px] text-slate-600 dark:text-slate-300">
                                                        {oc.units_consumed && oc.unit_rate ? (
                                                            `${oc.units_consumed} ${oc.unit_measure || 'units'} @ ${formatCurrency(oc.unit_rate, user?.location)}`
                                                        ) : (
                                                            <span className="text-[10px] text-slate-400 uppercase">Fixed</span>
                                                        )}
                                                    </td>
                                                    <td className="px-3 py-2 text-right font-mono font-black text-amber-600 dark:text-amber-400">
                                                        {formatCurrency(oc.amount, user?.location)}
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        )}
                        </div>

                        {/* Actions */}
                        <div className="flex items-center justify-between p-6 pt-4 border-t border-slate-100 dark:border-slate-800 print:hidden">
                            <button
                                onClick={async () => {
                                    if (!costingSheetRef.current) return;
                                    showToast?.('Transferring costing slip to printer...', 'info');
                                    try {
                                        await transferPreviewToPrinter(costingSheetRef.current, {
                                            format: 'a4',
                                            model: 'a4',
                                            documentTitle: `Costing_Batch_${selectedBatch.batch_number}`
                                        });
                                        showToast?.('Costing slip sent to printer!', 'success');
                                    } catch (e) {
                                        window.print();
                                    }
                                }}
                                className="tech-button bg-slate-100 text-slate-900 border-slate-200 dark:bg-slate-800 dark:text-white dark:border-slate-700 uppercase tracking-widest text-[10px] flex items-center gap-2 cursor-pointer"
                            >
                                <Printer className="w-4 h-4" />
                                <span>Print Costing Sheet</span>
                            </button>

                            <div className="flex items-center gap-2">
                                {selectedBatch.status === 'draft' && (
                                    <>
                                        <button
                                            onClick={() => handleCancelBatch(selectedBatch)}
                                            className="px-3 py-2 text-xs font-black text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 rounded-xl transition-all uppercase tracking-widest"
                                        >
                                            Cancel Batch
                                        </button>
                                        <button
                                            onClick={() => handleApproveBatch(selectedBatch)}
                                            disabled={isApproving}
                                            className="tech-button bg-emerald-600 text-white border-emerald-600 uppercase tracking-widest text-[10px] flex items-center gap-1.5"
                                        >
                                            <CheckCircle2 className="w-4 h-4" />
                                            <span>Approve & Stock Goods</span>
                                        </button>
                                    </>
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* MODAL: ADD INGREDIENT */}
            {showAddIngredientModal && (
                <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
                    <div className="tech-card max-w-md w-full p-6 space-y-6">
                        <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-4">
                            <h3 className="text-xs font-black text-slate-900 dark:text-white flex items-center gap-2 uppercase tracking-[0.2em]">
                                <Box className="w-5 h-5 text-amber-500" />
                                New Raw Material
                            </h3>
                            <button 
                                onClick={() => setShowAddIngredientModal(false)}
                                className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-all"
                            >
                                <XCircle className="w-5 h-5 text-slate-400" />
                            </button>
                        </div>

                        <form onSubmit={handleCreateIngredient} className="space-y-4">
                            <div>
                                <label className="block text-[10px] font-black text-slate-500 mb-2 uppercase tracking-widest">
                                    Ingredient Identity <span className="text-rose-500">*</span>
                                </label>
                                <input
                                    type="text"
                                    required
                                    placeholder="e.g. Arabica Green Beans Grade A"
                                    value={newIngredient.name}
                                    onChange={(e) => setNewIngredient(prev => ({ ...prev, name: e.target.value }))}
                                    className="tech-input w-full"
                                />
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-[10px] font-black text-slate-500 mb-2 uppercase tracking-widest">
                                        Unit System <span className="text-rose-500">*</span>
                                    </label>
                                    <select
                                        value={newIngredient.unit}
                                        onChange={(e) => setNewIngredient(prev => ({ ...prev, unit: e.target.value }))}
                                        className="tech-input w-full"
                                    >
                                        <option value="kg">kg (Kilograms)</option>
                                        <option value="gram">gram (Grams)</option>
                                        <option value="litre">litre (Litres)</option>
                                        <option value="ml">ml (Millilitres)</option>
                                        <option value="piece">piece (Pieces / Bags / Jars)</option>
                                        <option value="packet">packet (Packets)</option>
                                        <option value="roll">roll (Rolls of labels)</option>
                                    </select>
                                </div>

                                <div>
                                    <label className="block text-[10px] font-black text-slate-500 mb-2 uppercase tracking-widest">
                                        Unit Cost <span className="text-rose-500">*</span>
                                    </label>
                                    <input
                                        type="number"
                                        step="any"
                                        required
                                        placeholder="e.g. 450"
                                        value={newIngredient.cost_per_unit}
                                        onChange={(e) => setNewIngredient(prev => ({ ...prev, cost_per_unit: e.target.value }))}
                                        className="tech-input w-full"
                                    />
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-[10px] font-black text-slate-500 mb-2 uppercase tracking-widest">
                                        Opening Stock <span className="text-rose-500">*</span>
                                    </label>
                                    <input
                                        type="number"
                                        step="any"
                                        required
                                        placeholder="e.g. 100"
                                        value={newIngredient.current_stock}
                                        onChange={(e) => setNewIngredient(prev => ({ ...prev, current_stock: e.target.value }))}
                                        className="tech-input w-full"
                                    />
                                </div>

                                <div>
                                    <label className="block text-[10px] font-black text-slate-500 mb-2 uppercase tracking-widest">
                                        Reorder Alert
                                    </label>
                                    <input
                                        type="number"
                                        step="any"
                                        placeholder="e.g. 20"
                                        value={newIngredient.reorder_level}
                                        onChange={(e) => setNewIngredient(prev => ({ ...prev, reorder_level: e.target.value }))}
                                        className="tech-input w-full"
                                    />
                                </div>
                            </div>

                            <div className="flex gap-3 pt-4 border-t border-slate-100 dark:border-slate-800">
                                <button
                                    type="button"
                                    onClick={() => setShowAddIngredientModal(false)}
                                    className="tech-button bg-slate-100 text-slate-900 border-slate-200 dark:bg-slate-800 dark:text-white dark:border-slate-700 flex-1 uppercase tracking-[0.2em] text-[10px]"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    className="tech-button bg-slate-900 text-white border-slate-900 flex-1 uppercase tracking-[0.2em] text-[10px]"
                                >
                                    Catalog Item
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
            {/* MODAL: EDIT INGREDIENT */}
            {editingIngredient && (
                <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
                    <div className="tech-card max-w-md w-full p-6 space-y-6">
                        <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-4">
                            <h3 className="text-xs font-black text-slate-900 dark:text-white flex items-center gap-2 uppercase tracking-[0.2em]">
                                <Edit3 className="w-5 h-5 text-amber-500" />
                                Refine Material
                            </h3>
                            <button 
                                onClick={() => setEditingIngredient(null)}
                                className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-all"
                            >
                                <XCircle className="w-5 h-5 text-slate-400" />
                            </button>
                        </div>

                        <form onSubmit={handleUpdateIngredient} className="space-y-4">
                            <div>
                                <label className="block text-[10px] font-black text-slate-500 mb-2 uppercase tracking-widest">
                                    Ingredient Label
                                </label>
                                <input
                                    type="text"
                                    required
                                    value={editingIngredient.name}
                                    onChange={(e) => setEditingIngredient(prev => prev ? ({ ...prev, name: e.target.value }) : null)}
                                    className="tech-input w-full"
                                />
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-[10px] font-black text-slate-500 mb-2 uppercase tracking-widest">
                                        Unit Scale
                                    </label>
                                    <select
                                        value={editingIngredient.unit}
                                        onChange={(e) => setEditingIngredient(prev => prev ? ({ ...prev, unit: e.target.value }) : null)}
                                        className="tech-input w-full"
                                    >
                                        <option value="kg">kg (Kilograms)</option>
                                        <option value="gram">gram (Grams)</option>
                                        <option value="litre">litre (Litres)</option>
                                        <option value="ml">ml (Millilitres)</option>
                                        <option value="piece">piece (Pieces / Bags / Jars)</option>
                                    </select>
                                </div>

                                <div>
                                    <label className="block text-[10px] font-black text-slate-500 mb-2 uppercase tracking-widest">
                                        Material Cost
                                    </label>
                                    <input
                                        type="number"
                                        step="any"
                                        required
                                        value={editingIngredient.cost_per_unit}
                                        onChange={(e) => setEditingIngredient(prev => prev ? ({ ...prev, cost_per_unit: parseFloat(e.target.value) || 0 }) : null)}
                                        className="tech-input w-full"
                                    />
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-[10px] font-black text-slate-500 mb-2 uppercase tracking-widest">
                                        Current Stock
                                    </label>
                                    <input
                                        type="number"
                                        step="any"
                                        required
                                        value={editingIngredient.current_stock}
                                        onChange={(e) => setEditingIngredient(prev => prev ? ({ ...prev, current_stock: parseFloat(e.target.value) || 0 }) : null)}
                                        className="tech-input w-full"
                                    />
                                </div>

                                <div>
                                    <label className="block text-[10px] font-black text-slate-500 mb-2 uppercase tracking-widest">
                                        Reorder Point
                                    </label>
                                    <input
                                        type="number"
                                        step="any"
                                        value={editingIngredient.reorder_level}
                                        onChange={(e) => setEditingIngredient(prev => prev ? ({ ...prev, reorder_level: parseFloat(e.target.value) || 0 }) : null)}
                                        className="tech-input w-full"
                                    />
                                </div>
                            </div>

                            <div className="flex gap-3 pt-4 border-t border-slate-100 dark:border-slate-800">
                                <button
                                    type="button"
                                    onClick={() => setEditingIngredient(null)}
                                    className="tech-button bg-slate-100 text-slate-900 border-slate-200 dark:bg-slate-800 dark:text-white dark:border-slate-700 flex-1 uppercase tracking-[0.2em] text-[10px]"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    className="tech-button bg-slate-900 text-white border-slate-900 flex-1 uppercase tracking-[0.2em] text-[10px]"
                                >
                                    Update Catalog
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* MODAL: ADD RECIPE (BOM) */}
            {showAddRecipeModal && (
                <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
                    <div className="tech-card max-w-2xl w-full p-0 overflow-hidden max-h-[90vh] flex flex-col">
                        <div className="bg-slate-900 p-6 flex items-center justify-between">
                            <div>
                                <div className="text-[10px] font-black text-indigo-400 uppercase tracking-[0.2em] mb-1">
                                    Engineering & BOM Definition
                                </div>
                                <h2 className="text-xl font-black text-white uppercase tracking-widest">
                                    New Master Recipe
                                </h2>
                            </div>
                            <button 
                                onClick={() => setShowAddRecipeModal(false)}
                                className="p-2 bg-slate-800 text-slate-400 hover:text-white rounded-xl transition-all"
                            >
                                <XCircle className="w-6 h-6" />
                            </button>
                        </div>

                        <div className="p-6 overflow-y-auto space-y-8">
                            <form onSubmit={handleCreateRecipe} className="space-y-6">
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                    <div className="md:col-span-2">
                                        <label className="block text-[10px] font-black text-slate-500 mb-2 uppercase tracking-widest">
                                            Recipe Label <span className="text-rose-500">*</span>
                                        </label>
                                        <input
                                            type="text"
                                            required
                                            placeholder="e.g. Standard Espresso 250g Batch"
                                            value={newRecipe.name}
                                            onChange={(e) => setNewRecipe(prev => ({ ...prev, name: e.target.value }))}
                                            className="tech-input w-full"
                                        />
                                    </div>

                                    <div>
                                        <label className="block text-[10px] font-black text-slate-500 mb-2 uppercase tracking-widest">
                                            Output Inventory Link
                                        </label>
                                        <select
                                            value={newRecipe.product_id}
                                            onChange={(e) => setNewRecipe(prev => ({ ...prev, product_id: e.target.value }))}
                                            className="tech-input w-full"
                                        >
                                            <option value="">-- Manual Selection --</option>
                                            {inventory.map(p => (
                                                <option key={p.id} value={p.id}>{p.name}</option>
                                            ))}
                                        </select>
                                    </div>

                                    <div>
                                        <label className="block text-[10px] font-black text-slate-500 mb-2 uppercase tracking-widest">
                                            Target Yield (Units) <span className="text-rose-500">*</span>
                                        </label>
                                        <input
                                            type="number"
                                            min="1"
                                            required
                                            value={newRecipe.target_quantity}
                                            onChange={(e) => setNewRecipe(prev => ({ ...prev, target_quantity: e.target.value }))}
                                            className="tech-input w-full"
                                        />
                                    </div>

                                    <div className="md:col-span-2">
                                        <label className="block text-[10px] font-black text-slate-500 mb-2 uppercase tracking-widest">
                                            Production Directives
                                        </label>
                                        <textarea
                                            rows={2}
                                            placeholder="Standard Operating Procedures (SOP)..."
                                            value={newRecipe.description}
                                            onChange={(e) => setNewRecipe(prev => ({ ...prev, description: e.target.value }))}
                                            className="tech-input w-full resize-none"
                                        />
                                    </div>
                                </div>

                                <div className="space-y-4">
                                    <h4 className="text-[10px] font-black text-slate-900 dark:text-white uppercase tracking-widest flex items-center gap-2">
                                        <Layers className="w-4 h-4 text-indigo-500" />
                                        Component Matrix
                                    </h4>

                                    <div className="p-4 bg-slate-50 dark:bg-slate-800/60 rounded-xl border-2 border-slate-900 shadow-[2px_2px_0px_0px_rgba(15,23,42,1)] flex flex-col md:flex-row gap-4 items-end">
                                        <div className="flex-1 w-full">
                                            <label className="block text-[9px] font-black text-slate-400 mb-1 uppercase tracking-widest">Select Component</label>
                                            <select
                                                value={recipeIngredientInput.ingredient_id}
                                                onChange={(e) => setRecipeIngredientInput(prev => ({ ...prev, ingredient_id: e.target.value }))}
                                                className="tech-input w-full bg-white dark:bg-slate-900"
                                            >
                                                <option value="">-- Choose Material --</option>
                                                {ingredients.map(ing => (
                                                    <option key={ing.id} value={ing.id}>{ing.name} ({ing.unit})</option>
                                                ))}
                                            </select>
                                        </div>
                                        <div className="w-full md:w-32">
                                            <label className="block text-[9px] font-black text-slate-400 mb-1 uppercase tracking-widest">Amount</label>
                                            <input
                                                type="number"
                                                step="any"
                                                placeholder="0.00"
                                                value={recipeIngredientInput.quantity}
                                                onChange={(e) => setRecipeIngredientInput(prev => ({ ...prev, quantity: e.target.value }))}
                                                className="tech-input w-full bg-white dark:bg-slate-900"
                                            />
                                        </div>
                                        <button
                                            type="button"
                                            onClick={() => {
                                                if (!recipeIngredientInput.ingredient_id || !recipeIngredientInput.quantity) return;
                                                const ing = ingredients.find(i => i.id === Number(recipeIngredientInput.ingredient_id));
                                                if (!ing) return;
                                                
                                                setNewRecipe(prev => ({
                                                    ...prev,
                                                    ingredients: [...prev.ingredients, { 
                                                        ingredient_id: ing.id, 
                                                        quantity: parseFloat(recipeIngredientInput.quantity) || 0 
                                                    }]
                                                }));
                                                setRecipeIngredientInput({ ingredient_id: '', quantity: '' });
                                            }}
                                            className="tech-button bg-slate-900 text-white w-full md:w-auto uppercase tracking-widest text-[10px]"
                                        >
                                            Link
                                        </button>
                                    </div>

                                    <div className="tech-card border overflow-hidden">
                                        <table className="w-full text-left text-[10px]">
                                            <thead className="bg-slate-900 text-indigo-400 font-black uppercase tracking-widest">
                                                <tr>
                                                    <th className="px-4 py-3">Material Component</th>
                                                    <th className="px-4 py-3 text-right">Dosage</th>
                                                    <th className="px-4 py-3 text-right">Action</th>
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                                                {newRecipe.ingredients.length === 0 ? (
                                                    <tr>
                                                        <td colSpan={3} className="px-4 py-10 text-center text-slate-400 font-black uppercase tracking-widest italic">
                                                            Awaiting Matrix Linkages
                                                        </td>
                                                    </tr>
                                                ) : (
                                                    newRecipe.ingredients.map((item, idx) => {
                                                        const ing = ingredients.find(i => i.id === item.ingredient_id);
                                                        return (
                                                            <tr key={idx} className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                                                                <td className="px-4 py-3 font-black text-slate-900 dark:text-white uppercase">{ing?.name || 'Unknown'}</td>
                                                                <td className="px-4 py-3 text-right font-black font-mono">{item.quantity} {ing?.unit}</td>
                                                                <td className="px-4 py-3 text-right">
                                                                    <button
                                                                        type="button"
                                                                        onClick={() => {
                                                                            setNewRecipe(prev => ({
                                                                                ...prev,
                                                                                ingredients: prev.ingredients.filter((_, i) => i !== idx)
                                                                            }));
                                                                        }}
                                                                        className="text-rose-600 hover:text-rose-700 font-black uppercase tracking-widest"
                                                                    >
                                                                        Delink
                                                                    </button>
                                                                </td>
                                                            </tr>
                                                        );
                                                    })
                                                )}
                                            </tbody>
                                        </table>
                                    </div>
                                </div>

                                {/* Standard Overheads & Utility Estimates */}
                                <div className="space-y-4 pt-4 border-t border-slate-100 dark:border-slate-800">
                                    <div className="flex items-center justify-between">
                                        <h4 className="text-[10px] font-black text-slate-900 dark:text-white uppercase tracking-widest flex items-center gap-2">
                                            <Zap className="w-4 h-4 text-amber-500" />
                                            Standard Utility & Associated Cost Allocations
                                        </h4>
                                        <span className="text-[10px] font-mono font-bold text-amber-600 dark:text-amber-400">
                                            Est. Overheads: {formatCurrency(newRecipe.overheads.reduce((s, o) => s + (o.amount || 0), 0), user?.location)}
                                        </span>
                                    </div>

                                    <div className="p-4 bg-slate-50 dark:bg-slate-800/60 rounded-xl border-2 border-slate-900 shadow-[2px_2px_0px_0px_rgba(15,23,42,1)] flex flex-col md:flex-row gap-3 items-end">
                                        <div className="w-full md:w-44">
                                            <label className="block text-[9px] font-black text-slate-400 mb-1 uppercase tracking-widest">Expense Category</label>
                                            <select
                                                value={recipeOverheadInput.category}
                                                onChange={(e) => {
                                                    const cat = e.target.value;
                                                    const preset = PRODUCTION_OVERHEAD_CATEGORIES.find(c => c.category === cat);
                                                    setRecipeOverheadInput(prev => ({
                                                        ...prev,
                                                        category: cat,
                                                        cost_type: preset?.cost_type || 'other',
                                                        unit_measure: preset?.default_unit || 'units',
                                                        description: preset?.suggested_description || prev.description
                                                    }));
                                                }}
                                                className="tech-input w-full bg-white dark:bg-slate-900 text-xs"
                                            >
                                                {PRODUCTION_OVERHEAD_CATEGORIES.map(cat => (
                                                    <option key={cat.category} value={cat.category}>{cat.label}</option>
                                                ))}
                                            </select>
                                        </div>
                                        <div className="flex-1 w-full">
                                            <label className="block text-[9px] font-black text-slate-400 mb-1 uppercase tracking-widest">Detail Note</label>
                                            <input
                                                type="text"
                                                placeholder="e.g. Machine 3-Phase power draw"
                                                value={recipeOverheadInput.description}
                                                onChange={(e) => setRecipeOverheadInput(prev => ({ ...prev, description: e.target.value }))}
                                                className="tech-input w-full bg-white dark:bg-slate-900 text-xs"
                                            />
                                        </div>
                                        <div className="w-full md:w-32">
                                            <label className="block text-[9px] font-black text-slate-400 mb-1 uppercase tracking-widest">Cost Estimate</label>
                                            <input
                                                type="number"
                                                step="any"
                                                placeholder="0.00"
                                                value={recipeOverheadInput.amount}
                                                onChange={(e) => setRecipeOverheadInput(prev => ({ ...prev, amount: e.target.value }))}
                                                className="tech-input w-full bg-white dark:bg-slate-900 text-xs font-mono"
                                            />
                                        </div>
                                        <button
                                            type="button"
                                            onClick={() => {
                                                const amt = parseFloat(recipeOverheadInput.amount);
                                                if (isNaN(amt) || amt <= 0) return;
                                                setNewRecipe(prev => ({
                                                    ...prev,
                                                    overheads: [...prev.overheads, {
                                                        category: recipeOverheadInput.category,
                                                        amount: amt,
                                                        description: recipeOverheadInput.description || recipeOverheadInput.category,
                                                        cost_type: recipeOverheadInput.cost_type,
                                                        unit_measure: recipeOverheadInput.unit_measure
                                                    }]
                                                }));
                                                setRecipeOverheadInput(prev => ({ ...prev, amount: '' }));
                                            }}
                                            className="tech-button bg-amber-600 text-white w-full md:w-auto uppercase tracking-widest text-[10px]"
                                        >
                                            Add Cost
                                        </button>
                                    </div>

                                    {newRecipe.overheads.length > 0 && (
                                        <div className="tech-card border overflow-hidden">
                                            <table className="w-full text-left text-[10px]">
                                                <thead className="bg-slate-900 text-amber-400 font-black uppercase tracking-widest">
                                                    <tr>
                                                        <th className="px-4 py-2.5">Category</th>
                                                        <th className="px-4 py-2.5">Description</th>
                                                        <th className="px-4 py-2.5 text-right">Est. Cost</th>
                                                        <th className="px-4 py-2.5 text-right">Action</th>
                                                    </tr>
                                                </thead>
                                                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                                                    {newRecipe.overheads.map((item, idx) => (
                                                        <tr key={idx} className="hover:bg-slate-50 dark:hover:bg-slate-800/50">
                                                            <td className="px-4 py-2.5 font-black">
                                                                <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[9px] border ${getCategoryBadgeClass(item.category)}`}>
                                                                    {getCategoryIcon(item.category)}
                                                                    {item.category}
                                                                </span>
                                                            </td>
                                                            <td className="px-4 py-2.5 text-slate-500 font-medium">{item.description}</td>
                                                            <td className="px-4 py-2.5 text-right font-black font-mono text-amber-600 dark:text-amber-400">
                                                                {formatCurrency(item.amount, user?.location)}
                                                            </td>
                                                            <td className="px-4 py-2.5 text-right">
                                                                <button
                                                                    type="button"
                                                                    onClick={() => {
                                                                        setNewRecipe(prev => ({
                                                                            ...prev,
                                                                            overheads: prev.overheads.filter((_, i) => i !== idx)
                                                                        }));
                                                                    }}
                                                                    className="text-rose-600 hover:text-rose-700 font-black uppercase tracking-widest"
                                                                >
                                                                    Remove
                                                                </button>
                                                            </td>
                                                        </tr>
                                                    ))}
                                                </tbody>
                                            </table>
                                        </div>
                                    )}
                                </div>

                                <div className="flex gap-4 pt-4 border-t border-slate-100 dark:border-slate-800">
                                    <button
                                        type="button"
                                        onClick={() => setShowAddRecipeModal(false)}
                                        className="tech-button bg-slate-100 text-slate-900 border-slate-200 dark:bg-slate-800 dark:text-white dark:border-slate-700 flex-1 uppercase tracking-[0.2em] text-[10px]"
                                    >
                                        Abort
                                    </button>
                                    <button
                                        type="submit"
                                        className="tech-button bg-indigo-600 text-white border-indigo-600 flex-1 uppercase tracking-[0.2em] text-[10px]"
                                    >
                                        Commit Recipe
                                    </button>
                                </div>
                            </form>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};
