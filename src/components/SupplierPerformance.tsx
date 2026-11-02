import React, { useEffect, useRef, useState } from 'react';
import * as d3 from 'd3';
import { getInteropRequests } from '../api';
import { InteropRequest, Trader } from '../types';
import { useAppContext } from '../context';
import { Clock, TrendingUp, AlertCircle, BarChart2 } from 'lucide-react';

export const SupplierPerformance: React.FC<{ traderId: number | 'all' }> = ({ traderId }) => {
    const { traders } = useAppContext();
    const [requests, setRequests] = useState<InteropRequest[]>([]);
    const [loading, setLoading] = useState(true);
    const chartRef = useRef<SVGSVGElement>(null);

    useEffect(() => {
        const fetchRequests = async () => {
            setLoading(true);
            try {
                const res = await getInteropRequests(traderId === 'all' ? undefined : traderId);
                setRequests(res);
            } catch (err) {
                console.error("Failed to fetch interop requests:", err);
            } finally {
                setLoading(false);
            }
        };
        fetchRequests();
    }, [traderId]);

    useEffect(() => {
        if (!loading && requests.length > 0 && chartRef.current) {
            drawChart();
        }
    }, [loading, requests]);

    const drawChart = () => {
        const data = requests
            .filter(r => r.status === 'received' && r.createdAt && r.updatedAt)
            .map(r => {
                const start = new Date(r.createdAt).getTime();
                const end = new Date(r.updatedAt).getTime();
                const leadTimeHours = (end - start) / (1000 * 60 * 60);
                const supplier = traders.find(t => t.id === r.providerId);
                return {
                    id: r.id,
                    itemName: r.itemName,
                    supplierName: supplier?.businessName || supplier?.fullName || 'Unknown',
                    leadTime: Math.max(0.1, leadTimeHours), // Min 0.1 for visibility
                    date: new Date(r.updatedAt).toLocaleDateString()
                };
            })
            .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

        if (data.length === 0) return;

        // Clear previous chart
        d3.select(chartRef.current).selectAll("*").remove();

        const margin = { top: 40, right: 30, bottom: 60, left: 60 };
        const width = 800 - margin.left - margin.right;
        const height = 400 - margin.top - margin.bottom;

        const svg = d3.select(chartRef.current)
            .attr("width", width + margin.left + margin.right)
            .attr("height", height + margin.top + margin.bottom)
            .append("g")
            .attr("transform", `translate(${margin.left},${margin.top})`);

        // X axis
        const x = d3.scaleBand()
            .range([0, width])
            .domain(data.map(d => `${d.supplierName} (${d.itemName})`))
            .padding(0.2);

        svg.append("g")
            .attr("transform", `translate(0,${height})`)
            .call(d3.axisBottom(x))
            .selectAll("text")
            .attr("transform", "translate(-10,0)rotate(-45)")
            .style("text-anchor", "end")
            .style("font-size", "10px")
            .style("font-weight", "600")
            .style("fill", "#64748b");

        // Y axis
        const y = d3.scaleLinear()
            .domain([0, d3.max(data, d => d.leadTime) || 10])
            .range([height, 0]);

        svg.append("g")
            .call(d3.axisLeft(y).ticks(5))
            .style("font-size", "10px")
            .style("font-weight", "600")
            .style("fill", "#64748b");

        // Add Y axis label
        svg.append("text")
            .attr("text-anchor", "end")
            .attr("transform", "rotate(-90)")
            .attr("y", -margin.left + 20)
            .attr("x", -height / 2 + 50)
            .text("Lead Time (Hours)")
            .style("font-size", "10px")
            .style("font-weight", "bold")
            .style("fill", "#94a3b8")
            .style("text-transform", "uppercase")
            .style("letter-spacing", "0.05em");

        // Bars
        const colorScale = d3.scaleOrdinal(d3.schemeBlues[9]);

        svg.selectAll("mybar")
            .data(data)
            .enter()
            .append("rect")
            .attr("x", d => x(`${d.supplierName} (${d.itemName})`) || 0)
            .attr("y", height)
            .attr("width", x.bandwidth())
            .attr("height", 0)
            .attr("fill", (d, i) => d3.interpolateBlues(0.5 + (i / data.length) * 0.5))
            .attr("rx", 6)
            .transition()
            .duration(1000)
            .attr("y", d => y(d.leadTime))
            .attr("height", d => height - y(d.leadTime));

        // Tooltip interaction
        const tooltip = d3.select("body").append("div")
            .attr("class", "d3-tooltip")
            .style("position", "absolute")
            .style("visibility", "hidden")
            .style("background", "white")
            .style("padding", "12px")
            .style("border-radius", "12px")
            .style("box-shadow", "0 10px 15px -3px rgba(0,0,0,0.1)")
            .style("font-size", "12px")
            .style("pointer-events", "none")
            .style("z-index", "1000");

        svg.selectAll("rect")
            .on("mouseover", function(event, d: any) {
                d3.select(this).attr("opacity", 0.8);
                tooltip.style("visibility", "visible")
                    .html(`
                        <div class="font-black text-slate-900 mb-1">${d.itemName}</div>
                        <div class="text-slate-500 font-bold uppercase text-[10px] tracking-widest mb-2">Supplier: ${d.supplierName}</div>
                        <div class="flex items-center gap-2">
                            <span class="w-2 h-2 rounded-full bg-blue-500"></span>
                            <span class="font-bold text-slate-700">Lead Time: ${d.leadTime.toFixed(1)} hrs</span>
                        </div>
                        <div class="text-[10px] text-slate-400 mt-1">Fulfilled on ${d.date}</div>
                    `);
            })
            .on("mousemove", function(event) {
                tooltip.style("top", (event.pageY - 10) + "px")
                       .style("left", (event.pageX + 10) + "px");
            })
            .on("mouseout", function() {
                d3.select(this).attr("opacity", 1);
                tooltip.style("visibility", "hidden");
            });
    };

    const avgLeadTime = requests.filter(r => r.status === 'received').length > 0 
        ? requests.filter(r => r.status === 'received').reduce((acc, r) => {
            const start = new Date(r.createdAt).getTime();
            const end = new Date(r.updatedAt).getTime();
            return acc + (end - start);
        }, 0) / (requests.filter(r => r.status === 'received').length * 1000 * 60 * 60)
        : 0;

    if (loading) {
        return (
            <div className="h-64 flex flex-col items-center justify-center text-slate-400">
                <RefreshCw className="animate-spin mb-3 text-blue-500" size={32} />
                <p className="text-xs font-bold uppercase tracking-widest">Analyzing Supply Chain...</p>
            </div>
        );
    }

    const fulfilledRequests = requests.filter(r => r.status === 'received');

    return (
        <div className="space-y-6 animate-in fade-in duration-500">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="bg-white border border-slate-200 rounded-3xl p-6 shadow-sm flex items-center gap-5">
                    <div className="w-14 h-14 bg-blue-50 rounded-2xl flex items-center justify-center text-blue-600 shadow-inner">
                        <Clock size={28} />
                    </div>
                    <div>
                        <div className="text-2xl font-black text-slate-900 font-mono">
                            {avgLeadTime.toFixed(1)}h
                        </div>
                        <div className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">Avg. Lead Time</div>
                    </div>
                </div>
                <div className="bg-white border border-slate-200 rounded-3xl p-6 shadow-sm flex items-center gap-5">
                    <div className="w-14 h-14 bg-emerald-50 rounded-2xl flex items-center justify-center text-emerald-600 shadow-inner">
                        <TrendingUp size={28} />
                    </div>
                    <div>
                        <div className="text-2xl font-black text-slate-900 font-mono">
                            {fulfilledRequests.length}
                        </div>
                        <div className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">Fulfilled Requests</div>
                    </div>
                </div>
                <div className="bg-white border border-slate-200 rounded-3xl p-6 shadow-sm flex items-center gap-5">
                    <div className="w-14 h-14 bg-amber-50 rounded-2xl flex items-center justify-center text-amber-600 shadow-inner">
                        <AlertCircle size={28} />
                    </div>
                    <div>
                        <div className="text-2xl font-black text-slate-900 font-mono">
                            {requests.filter(r => r.status === 'pending').length}
                        </div>
                        <div className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">Pending Fulfillment</div>
                    </div>
                </div>
            </div>

            <div className="bg-white border border-slate-200 rounded-3xl p-8 shadow-sm">
                <div className="flex items-center justify-between mb-8">
                    <div>
                        <h4 className="text-xl font-black text-slate-900 uppercase tracking-tighter flex items-center gap-3">
                            <BarChart2 size={24} className="text-blue-600" />
                            Supplier Fulfillment Performance
                        </h4>
                        <p className="text-sm text-slate-500 font-bold">Tracking lead time between Order Placement and Goods Receipt</p>
                    </div>
                </div>

                <div className="overflow-x-auto">
                    {fulfilledRequests.length > 0 ? (
                        <svg ref={chartRef} className="mx-auto"></svg>
                    ) : (
                        <div className="h-80 flex flex-col items-center justify-center text-slate-400 border-2 border-dashed border-slate-100 rounded-3xl">
                            <BarChart2 size={64} className="mb-4 opacity-10" />
                            <p className="text-sm font-bold uppercase tracking-widest">No fulfilled requests to analyze lead times</p>
                        </div>
                    )}
                </div>
            </div>

            <div className="bg-white border border-slate-200 rounded-3xl overflow-hidden shadow-sm">
                <div className="p-6 border-b border-slate-100 bg-slate-50/50">
                    <h5 className="font-black text-slate-800 uppercase tracking-widest text-xs">Recent Supply Transactions</h5>
                </div>
                <table className="w-full text-left border-collapse">
                    <thead>
                        <tr className="bg-white border-b border-slate-100">
                            <th className="p-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Item</th>
                            <th className="p-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Supplier</th>
                            <th className="p-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Ordered</th>
                            <th className="p-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Fulfilled</th>
                            <th className="p-4 text-[10px] font-black text-slate-400 uppercase tracking-widest text-right">Lead Time</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-50">
                        {fulfilledRequests.slice(-5).reverse().map((r, idx) => {
                            const start = new Date(r.createdAt);
                            const end = new Date(r.updatedAt);
                            const leadTimeHours = (end.getTime() - start.getTime()) / (1000 * 60 * 60);
                            const supplier = traders.find(t => t.id === r.providerId);
                            return (
                                <tr key={idx} className="hover:bg-slate-50 transition-colors">
                                    <td className="p-4">
                                        <div className="font-bold text-slate-900 text-sm">{r.itemName}</div>
                                        <div className="text-[10px] font-mono text-slate-400 uppercase">{r.sku}</div>
                                    </td>
                                    <td className="p-4">
                                        <div className="text-xs font-bold text-slate-700">{supplier?.businessName || supplier?.fullName}</div>
                                    </td>
                                    <td className="p-4 text-xs text-slate-500">{start.toLocaleDateString()}</td>
                                    <td className="p-4 text-xs text-slate-500">{end.toLocaleDateString()}</td>
                                    <td className="p-4 text-right">
                                        <span className="text-sm font-black text-blue-600 font-mono">{leadTimeHours.toFixed(1)}h</span>
                                    </td>
                                </tr>
                            );
                        })}
                    </tbody>
                </table>
            </div>
        </div>
    );
};

const RefreshCw = ({ className, size }: { className?: string; size: number }) => (
    <svg className={className} width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M21 2v6h-6"/><path d="M3 12a9 9 0 0 1 15-6.7L21 8"/><path d="M3 22v-6h6"/><path d="M21 12a9 9 0 0 1-15 6.7L3 16"/>
    </svg>
);
