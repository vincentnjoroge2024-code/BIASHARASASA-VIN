import React, { useEffect, useRef, useMemo } from 'react';
import * as d3 from 'd3';
import { Transaction } from '../types';

interface PriceTrendChartProps {
    transactions: Transaction[];
    location?: string;
}

interface TrendData {
    name: string;
    values: { date: Date; price: number }[];
}

export const PriceTrendChart: React.FC<PriceTrendChartProps> = ({ transactions, location }) => {
    const svgRef = useRef<SVGSVGElement>(null);

    const trendData = useMemo(() => {
        if (!transactions.length) return [];

        // 1. Identify top 5 items by volume
        const itemVolume: { [key: string]: number } = {};
        transactions.forEach(tx => {
            tx.items.forEach(item => {
                itemVolume[item.name] = (itemVolume[item.name] || 0) + item.qty;
            });
        });

        const topItems = Object.entries(itemVolume)
            .sort(([, a], [, b]) => b - a)
            .slice(0, 5)
            .map(([name]) => name);

        // 2. Extract price trends for these items
        const trends: TrendData[] = topItems.map(name => {
            const values = transactions
                .filter(tx => tx.items.some(item => item.name === name))
                .map(tx => {
                    const item = tx.items.find(i => i.name === name);
                    return {
                        date: new Date(tx.date),
                        price: item?.price || 0
                    };
                })
                // Sort by date
                .sort((a, b) => a.date.getTime() - b.date.getTime());
            
            return { name, values };
        });

        return trends;
    }, [transactions]);

    useEffect(() => {
        if (!svgRef.current || !trendData.length) return;

        const margin = { top: 20, right: 150, bottom: 40, left: 60 };
        const width = 800 - margin.left - margin.right;
        const height = 400 - margin.top - margin.bottom;

        // Clear previous chart
        d3.select(svgRef.current).selectAll("*").remove();

        const svg = d3.select(svgRef.current)
            .attr("viewBox", `0 0 ${width + margin.left + margin.right} ${height + margin.top + margin.bottom}`)
            .append("g")
            .attr("transform", `translate(${margin.left},${margin.top})`);

        // Scales
        const allValues = trendData.flatMap(d => d.values);
        
        const x = d3.scaleTime()
            .domain(d3.extent(allValues, d => d.date) as [Date, Date])
            .range([0, width]);

        const y = d3.scaleLinear()
            .domain([0, d3.max(allValues, d => d.price) as number * 1.1])
            .range([height, 0]);

        const color = d3.scaleOrdinal(d3.schemeCategory10);

        // Axes
        svg.append("g")
            .attr("transform", `translate(0,${height})`)
            .call(d3.axisBottom(x).ticks(5))
            .attr("font-size", "12px")
            .attr("color", "#64748b");

        svg.append("g")
            .call(d3.axisLeft(y).tickFormat(d => `${d}`))
            .attr("font-size", "12px")
            .attr("color", "#64748b");

        // Grid lines
        svg.append("g")
            .attr("class", "grid")
            .attr("opacity", 0.1)
            .call(d3.axisLeft(y).tickSize(-width).tickFormat(() => ""));

        // Line generator
        const line = d3.line<{ date: Date; price: number }>()
            .x(d => x(d.date))
            .y(d => y(d.price))
            .curve(d3.curveMonotoneX);

        // Draw lines
        const series = svg.selectAll(".series")
            .data(trendData)
            .enter()
            .append("g")
            .attr("class", "series");

        series.append("path")
            .attr("fill", "none")
            .attr("stroke", (d, i) => color(i.toString()))
            .attr("stroke-width", 2.5)
            .attr("d", d => line(d.values))
            .attr("stroke-linejoin", "round")
            .attr("stroke-linecap", "round");

        // Legend/Labels at the end of lines
        series.append("text")
            .datum(d => ({ name: d.name, value: d.values[d.values.length - 1] }))
            .attr("transform", d => `translate(${x(d.value.date) + 5},${y(d.value.price)})`)
            .attr("x", 5)
            .attr("dy", ".35em")
            .style("font-size", "10px")
            .style("font-weight", "bold")
            .style("fill", (d, i) => color(i.toString()))
            .text(d => d.name);

        // Interactivity: Points
        series.selectAll("circle")
            .data(d => d.values)
            .enter()
            .append("circle")
            .attr("cx", d => x(d.date))
            .attr("cy", d => y(d.price))
            .attr("r", 4)
            .attr("fill", (d, i, nodes) => {
                const parentData = d3.select(nodes[i].parentNode as any).datum() as TrendData;
                return color(trendData.findIndex(t => t.name === parentData.name).toString());
            })
            .attr("stroke", "white")
            .attr("stroke-width", 1.5)
            .on("mouseover", function(event, d) {
                d3.select(this).attr("r", 6);
                // Simple tooltip logic can be added here if needed
            })
            .on("mouseout", function() {
                d3.select(this).attr("r", 4);
            });

    }, [trendData]);

    return (
        <div className="w-full bg-white border border-slate-200 rounded-2xl p-6 shadow-sm overflow-hidden">
            <div className="flex items-center justify-between mb-6">
                <h4 className="text-base font-bold text-slate-800 uppercase tracking-tight">
                    Historical Price Trends (Top Sellers)
                </h4>
                <div className="text-[10px] text-slate-400 font-bold uppercase">Dynamic D3 Visualizer</div>
            </div>
            <div className="w-full h-[400px]">
                {trendData.length > 0 ? (
                    <svg ref={svgRef} className="w-full h-full" preserveAspectRatio="xMidYMid meet" />
                ) : (
                    <div className="h-full flex flex-col items-center justify-center text-slate-400 bg-slate-50 rounded-xl border border-dashed border-slate-200">
                        <p className="text-xs">No transaction data available for price trend analysis.</p>
                    </div>
                )}
            </div>
        </div>
    );
};
