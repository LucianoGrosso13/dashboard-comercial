import React, { useState, useMemo } from 'react';
import { BarChart, Bar, LineChart, Line, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, ReferenceLine } from 'recharts';
import { Upload, TrendingUp, Users, MapPin, Target, Award, ChevronDown, ChevronUp, Maximize2, Minimize2, Eye, Calendar, RotateCcw, Megaphone, DollarSign } from 'lucide-react';
import Papa from 'papaparse';

// --- Helpers de Fecha ---
const parseDateToISO = (dateStr) => {
  if (!dateStr) return '';
  if (dateStr.match(/^\d{4}-\d{2}-\d{2}$/)) return dateStr;
  
  const cleanStr = dateStr.replace(/-/g, '/');
  const parts = cleanStr.split('/');
  
  if (parts.length === 3) {
      let day, month, year;
      if(parts[0].length === 4) {
          year = parts[0];
          month = parts[1];
          day = parts[2];
      } else {
          day = parts[0];
          month = parts[1];
          year = parts[2];
      }
      const pad = (n) => n.toString().padStart(2, '0');
      return `${year}-${pad(month)}-${pad(day)}`;
  }
  return '';
};

const formatDateDisplay = (isoDate) => {
  if (!isoDate) return '';
  const parts = isoDate.split('-');
  return `${parts[2]}/${parts[1]}`; // DD/MM
};

const App = () => {
  const [data, setData] = useState([]); // Leads
  const [marketingEvents, setMarketingEvents] = useState([]); // Eventos
  
  const [filters, setFilters] = useState({
    agente: 'Todos',
    provincia: 'Todas',
    fuente: 'Todas',
    startDate: '',
    endDate: ''
  });
  const [provinciaChartType, setProvinciaChartType] = useState('cotizacion');
  const [collapsedCharts, setCollapsedCharts] = useState({});
  const [collapsedKPIs, setCollapsedKPIs] = useState({});
  const [expandedChart, setExpandedChart] = useState(null);

  const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#14b8a6', '#f97316'];
  
  const EVENT_COLORS = {
    'pauta': '#ef4444',    // Rojo
    'organico': '#10b981', // Verde
    'evento': '#8b5cf6',   // Violeta
    'offline': '#6b7280',  // Gris
    'email': '#3b82f6',    // Azul
    'default': '#f59e0b'   // Naranja
  };

  // --- Carga de Archivos ---
  const handleFileUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: (results) => {
        const cleanedData = results.data.map(row => ({
          ...row,
          AGENTE: normalizeAgent(row.AGENTE),
          platform: normalizePlatform(row.platform),
          'Provincia Detectada': normalizeProvincia(row['Provincia Detectada']),
          'Tipo de Evento': row['Tipo de Evento']?.trim(),
          fecha: row.fecha?.trim(),
          VISITAS: row.VISITAS?.trim() || '',
          fechaISO: parseDateToISO(row.fecha?.trim())
        }));
        setData(cleanedData);
      }
    });
  };

  const handleEventsUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: (results) => {
        const events = results.data.map(row => {
            const dateVal = row['Fecha'] || row['fecha'];
            const nameVal = row['Nombre del Evento'] || row['Nombre'] || row['Evento'];
            const typeVal = row['Tipo'] || row['Categoria'];
            const platformVal = row['Plataforma'] || row['Medio'];
            
            if (!dateVal || !nameVal) return null;

            return {
                dateISO: parseDateToISO(dateVal),
                name: nameVal,
                type: typeVal?.toLowerCase() || 'default',
                platform: platformVal,
                investment: parseFloat(row['Inversion'] || 0)
            };
        }).filter(Boolean);
        // Ordenar por fecha
        events.sort((a, b) => a.dateISO.localeCompare(b.dateISO));
        setMarketingEvents(events);
      }
    });
  };

  // Normalizadores
  const normalizeAgent = (agent) => {
    if (!agent) return '';
    const normalized = agent.trim();
    if (normalized.toUpperCase() === 'PM') return 'Paola';
    if (normalized.toUpperCase() === 'IC') return 'Irina';
    return normalized.charAt(0).toUpperCase() + normalized.slice(1).toLowerCase();
  };

  const normalizePlatform = (platform) => {
    if (!platform) return 'Otro';
    const p = platform.toLowerCase().trim();
    if (p === 'wp' || p === 'whatsapp') return 'WhatsApp';
    if (p === 'ig' || p === 'instagram') return 'Instagram';
    if (p === 'facebook' || p === 'fb') return 'Facebook';
    return 'Otro';
  };

  const normalizeProvincia = (provincia) => {
    if (!provincia) return 'Sin Datos';
    return provincia.trim();
  };

  // Filtrar datos
  const filteredData = useMemo(() => {
    return data.filter(row => {
      const matchAgent = filters.agente === 'Todos' || row.AGENTE === filters.agente;
      const matchProvincia = filters.provincia === 'Todas' || row['Provincia Detectada'] === filters.provincia;
      const matchFuente = filters.fuente === 'Todas' || row.platform === filters.fuente;
      
      let matchDate = true;
      if (filters.startDate && row.fechaISO < filters.startDate) matchDate = false;
      if (filters.endDate && row.fechaISO > filters.endDate) matchDate = false;

      return matchAgent && matchProvincia && matchFuente && matchDate;
    });
  }, [data, filters]);
  
  const filteredEvents = useMemo(() => {
      return marketingEvents.filter(ev => {
          if (filters.startDate && ev.dateISO < filters.startDate) return false;
          if (filters.endDate && ev.dateISO > filters.endDate) return false;
          return true;
      });
  }, [marketingEvents, filters.startDate, filters.endDate]);

  const resetDates = () => {
    setFilters(prev => ({ ...prev, startDate: '', endDate: '' }));
  };

  // --- KPIs ---
  const kpis = useMemo(() => {
    const currentCotizaciones = filteredData.filter(row => 
      row['Tipo de Evento']?.toLowerCase().includes('cotización') ||
      row['Tipo de Evento']?.toLowerCase().includes('cotizacion')
    ).length;

    const currentOfertas = filteredData.filter(row => 
      row['Tipo de Evento']?.toLowerCase().includes('oferta comercial') ||
      row['Tipo de Evento']?.toLowerCase().includes('oferta')
    ).length;

    const currentVentas = filteredData.filter(row => 
      row['Tipo de Evento']?.toLowerCase().includes('venta')
    ).length;

    const funnelVentas = currentVentas;
    const funnelOfertas = currentOfertas + funnelVentas;
    const funnelCotizaciones = currentCotizaciones + funnelOfertas;
    const funnelLeads = filteredData.length;

    const visitasRows = filteredData.filter(row => {
      const v = row.VISITAS?.toLowerCase().trim();
      return v === 'showroom' || v === 'fabrica' || v === 'ambas';
    });
    const totalVisitas = visitasRows.length;
    const ratioVisitasLead = funnelLeads > 0 ? ((totalVisitas / funnelLeads) * 100).toFixed(1) : 0;
    
    const leadsTucuman = filteredData.filter(row => row['Provincia Detectada']?.toLowerCase().includes('tucum')).length;
    const visitasShowroom = visitasRows.filter(row => row.VISITAS?.toLowerCase().includes('showroom') || row.VISITAS?.toLowerCase().includes('ambas')).length;
    const ratioTucShowroom = leadsTucuman > 0 ? ((visitasShowroom / leadsTucuman) * 100).toFixed(1) : 0;

    const visitantesConCotizacion = visitasRows.filter(row => {
      const type = row['Tipo de Evento']?.toLowerCase() || '';
      return type.includes('cotización') || type.includes('cotizacion') || type.includes('oferta') || type.includes('venta');
    }).length;
    const porcentajeVisitasConCotiz = totalVisitas > 0 ? ((visitantesConCotizacion / totalVisitas) * 100).toFixed(1) : 0;
    const convLeadToCotiz = funnelLeads > 0 ? ((funnelCotizaciones / funnelLeads) * 100).toFixed(1) : 0;

    const totalInversion = filteredEvents.reduce((acc, curr) => acc + curr.investment, 0);

    return {
      funnel: {
        leads: funnelLeads,
        cotizaciones: funnelCotizaciones,
        ofertas: funnelOfertas,
        ventas: funnelVentas
      },
      cotizacionesActivas: currentCotizaciones,
      totalVisitas,
      ratioVisitasLead,
      ratioTucShowroom,
      porcentajeVisitasConCotiz,
      visitantesConCotizacion,
      convLeadToCotiz,
      leadsTucuman,
      visitasShowroom,
      totalInversion
    };
  }, [filteredData, filteredEvents]);

  // --- Datos Gráficos ---

  const uniqueAgents = useMemo(() => ['Todos', ...new Set(data.map(row => row.AGENTE))].filter(Boolean), [data]);
  const uniqueProvincias = useMemo(() => ['Todas', ...new Set(data.map(row => row['Provincia Detectada']))].filter(Boolean), [data]);

  const funnelData = [
    { name: 'Leads', value: kpis.funnel.leads, fill: '#3b82f6' },
    { name: 'Cotizaciones', value: kpis.funnel.cotizaciones, fill: '#10b981' },
    { name: 'Ofertas', value: kpis.funnel.ofertas, fill: '#f59e0b' },
    { name: 'Ventas', value: kpis.funnel.ventas, fill: '#ef4444' }
  ];

  const agentPerformance = useMemo(() => {
    const agentStats = {};
    filteredData.forEach(row => {
      const agent = row.AGENTE || 'Sin Agente';
      if (!agentStats[agent]) agentStats[agent] = { name: agent, Leads: 0, Cotizaciones: 0, OfertasComerciales: 0, Ventas: 0 };
      const type = row['Tipo de Evento']?.toLowerCase() || '';
      agentStats[agent].Leads++; 
      if (type.includes('cotización') || type.includes('cotizacion') || type.includes('oferta') || type.includes('venta')) agentStats[agent].Cotizaciones++;
      if (type.includes('oferta') || type.includes('venta')) agentStats[agent].OfertasComerciales++;
      if (type.includes('venta')) agentStats[agent].Ventas++;
    });
    return Object.values(agentStats);
  }, [filteredData]);

  const geoDistribution = useMemo(() => {
    const provinciaCounts = {};
    filteredData.forEach(row => {
      const prov = row['Provincia Detectada']?.trim() || 'Sin Datos';
      provinciaCounts[prov] = (provinciaCounts[prov] || 0) + 1;
    });
    return Object.entries(provinciaCounts)
      .filter(([_, count]) => count >= 4)
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value);
  }, [filteredData]);

  const totalMetricaProvincia = useMemo(() => {
    if (provinciaChartType === 'cotizacion') return kpis.funnel.cotizaciones;
    if (provinciaChartType === 'oferta') return kpis.funnel.ofertas;
    if (provinciaChartType === 'venta') return kpis.funnel.ventas;
    return kpis.funnel.leads;
  }, [provinciaChartType, kpis.funnel]);

  const datosPorProvincia = useMemo(() => {
    const provinciaCounts = {};
    filteredData.forEach(row => {
      let incluir = false;
      const type = row['Tipo de Evento']?.toLowerCase() || '';
      if (provinciaChartType === 'cotizacion' && (type.includes('cotización') || type.includes('cotizacion'))) incluir = true;
      else if (provinciaChartType === 'oferta' && (type.includes('oferta') || type.includes('oferta'))) incluir = true;
      else if (provinciaChartType === 'venta' && type.includes('venta')) incluir = true;

      if (incluir) {
        const prov = row['Provincia Detectada']?.trim() || 'Sin Datos';
        provinciaCounts[prov] = (provinciaCounts[prov] || 0) + 1;
      }
    });
    return Object.entries(provinciaCounts)
      .filter(([name, value]) => value > 0)
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value);
  }, [filteredData, provinciaChartType]);

  const visitasData = useMemo(() => {
    const visitaCounts = { 'Showroom': 0, 'Fábrica': 0, 'Ambas': 0 };
    filteredData.forEach(row => {
      const visita = row.VISITAS?.toLowerCase().trim();
      if (visita === 'showroom') visitaCounts['Showroom']++;
      else if (visita === 'fabrica') visitaCounts['Fábrica']++;
      else if (visita === 'ambas') visitaCounts['Ambas']++;
    });
    return Object.entries(visitaCounts).map(([name, value]) => ({ name, value })).filter(item => item.value > 0);
  }, [filteredData]);

  const visitasPorAgente = useMemo(() => {
    const agentVisitas = {};
    filteredData.forEach(row => {
      const visita = row.VISITAS?.toLowerCase().trim();
      if (visita === 'showroom' || visita === 'fabrica' || visita === 'ambas') {
        const agent = row.AGENTE || 'Sin Agente';
        agentVisitas[agent] = (agentVisitas[agent] || 0) + 1;
      }
    });
    return Object.entries(agentVisitas).map(([name, value]) => ({ name, Visitas: value })).sort((a, b) => b.Visitas - a.Visitas);
  }, [filteredData]);

  const dailyRegionData = useMemo(() => {
    const dataByDay = {};
    // 1. Llenar con Leads
    filteredData.forEach(row => {
      if (row.fechaISO) {
        const dateKey = row.fechaISO;
        const displayDate = formatDateDisplay(dateKey);
        if (!dataByDay[dateKey]) dataByDay[dateKey] = { date: dateKey, name: displayDate, Tucuman: 0, RestoNOA: 0, RestoPais: 0 };
        
        const prov = (row['Provincia Detectada'] || '').toLowerCase();
        const noaProvs = ['salta', 'jujuy', 'santiago', 'catamarca', 'rioja'];
        if (prov.includes('tucum')) dataByDay[dateKey].Tucuman++;
        else if (noaProvs.some(p => prov.includes(p))) dataByDay[dateKey].RestoNOA++;
        else dataByDay[dateKey].RestoPais++;
      }
    });

    // 2. Asegurar que existan entradas para los días de Eventos
    filteredEvents.forEach(ev => {
        if (ev.dateISO && !dataByDay[ev.dateISO]) {
            dataByDay[ev.dateISO] = { date: ev.dateISO, name: formatDateDisplay(ev.dateISO), Tucuman: 0, RestoNOA: 0, RestoPais: 0 };
        }
    });

    return Object.values(dataByDay).sort((a, b) => new Date(a.date) - new Date(b.date));
  }, [filteredData, filteredEvents]);

  const monthlyTrend = useMemo(() => {
    const monthCounts = {};
    filteredData.forEach(row => {
      if (row.fechaISO) {
        const parts = row.fechaISO.split('-');
        const monthStr = `${parts[1]}/${parts[0]}`; 
        if(monthStr) monthCounts[monthStr] = (monthCounts[monthStr] || 0) + 1;
      }
    });
    return Object.entries(monthCounts)
      .map(([name, value]) => ({ name, Contactos: value }))
      .sort((a, b) => {
        const [m1, y1] = a.name.split('/');
        const [m2, y2] = b.name.split('/');
        return new Date(y1, m1 - 1) - new Date(y2, m2 - 1);
      });
  }, [filteredData]);

  const socialByMonth = useMemo(() => {
    const monthPlatform = {};
    filteredData.forEach(row => {
      if (row.fechaISO) {
        const parts = row.fechaISO.split('-');
        const month = `${parts[1]}/${parts[0]}`; 
        
        if (!monthPlatform[month]) monthPlatform[month] = { name: month, Instagram: 0, Facebook: 0, WhatsApp: 0, Otro: 0 };
        const platform = row.platform || 'Otro';
        if (['Instagram', 'Facebook', 'WhatsApp', 'Otro'].includes(platform)) {
          monthPlatform[month][platform]++;
        }
      }
    });
    return Object.values(monthPlatform).sort((a, b) => {
      const [m1, y1] = a.name.split('/');
      const [m2, y2] = b.name.split('/');
      return new Date(y1, m1 - 1) - new Date(y2, m2 - 1);
    });
  }, [filteredData]);

  const weeklyRhythm = useMemo(() => {
    const dayNames = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];
    const dayCounts = { Lunes: 0, Martes: 0, Miércoles: 0, Jueves: 0, Viernes: 0, Sábado: 0, Domingo: 0 };
    filteredData.forEach(row => {
      if (row.fechaISO) {
        const parts = row.fechaISO.split('-');
        const date = new Date(parts[0], parts[1] - 1, parts[2]);
        if (!isNaN(date.getTime())) {
          const dayName = dayNames[date.getDay()];
          if (dayName) dayCounts[dayName]++;
        }
      }
    });
    return Object.entries(dayCounts).filter(([name]) => name && name !== 'undefined').map(([name, value]) => ({ name, Contactos: value }));
  }, [filteredData]);

  const qualityRanking = useMemo(() => {
    const platformStats = {};
    filteredData.forEach(row => {
      const platform = row.platform || 'Otro';
      if (!platformStats[platform]) platformStats[platform] = { leads: 0, cotizaciones: 0 };
      if (row['Tipo de Evento']?.toLowerCase().includes('lead')) platformStats[platform].leads++;
      if (row['Tipo de Evento']?.toLowerCase().includes('cotización') || row['Tipo de Evento']?.toLowerCase().includes('cotizacion')) platformStats[platform].cotizaciones++;
    });
    const ranking = Object.entries(platformStats).map(([name, stats]) => {
      const totalLeadsReal = stats.leads + stats.cotizaciones; 
      let conversion = 0;
      if (totalLeadsReal > 0) conversion = (stats.cotizaciones / totalLeadsReal) * 100;
      const conversionReal = parseFloat(conversion.toFixed(1));
      return { name, conversion: conversionReal, conversionDisplay: Math.min(conversionReal, 30), leads: totalLeadsReal, cotizaciones: stats.cotizaciones };
    });
    return ranking.filter(item => item.leads > 0 || item.cotizaciones > 0).sort((a, b) => b.conversion - a.conversion);
  }, [filteredData]);

  // UI Helpers
  const toggleCollapse = (chartId) => setCollapsedCharts(prev => ({ ...prev, [chartId]: !prev[chartId] }));
  const toggleKPICollapse = (kpiId) => setCollapsedKPIs(prev => ({ ...prev, [kpiId]: !prev[kpiId] }));
  const toggleExpand = (chartId) => setExpandedChart(expandedChart === chartId ? null : chartId);

  const CustomTooltip = ({ active, payload, label, total, totalMap }) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-white p-3 border border-gray-200 shadow-md rounded text-sm z-50">
          <p className="font-bold mb-1">{label || payload[0].payload.name}</p>
          {payload.map((entry, index) => {
            const key = entry.dataKey || entry.name;
            let denominator = 1;
            if (totalMap && totalMap[key]) denominator = totalMap[key]; 
            else if (total) denominator = total; 
            else denominator = kpis.funnel.leads; 
            const percent = denominator > 0 ? ((entry.value / denominator) * 100).toFixed(1) : 0;
            return <p key={index} style={{ color: entry.color }}>{entry.name}: {entry.value} ({percent}%)</p>;
          })}
        </div>
      );
    }
    return null;
  };
  
  const StackedTooltip = ({ active, payload, label }) => {
    if (active && payload && payload.length) {
      const totalDay = payload.reduce((sum, entry) => sum + (typeof entry.value === 'number' ? entry.value : 0), 0);
      return (
        <div className="bg-white p-3 border border-gray-200 shadow-md rounded text-sm z-50">
          <p className="font-bold mb-2">{label}</p>
          {payload.map((entry, index) => (
            <p key={index} style={{ color: entry.fill }}>{entry.name}: {entry.value} ({totalDay > 0 ? ((entry.value/totalDay)*100).toFixed(1) : 0}%)</p>
          ))}
          <div className="border-t mt-2 pt-1 font-semibold text-gray-600">Total: {totalDay}</div>
        </div>
      );
    }
    return null;
  };

  const ChartContainer = ({ id, title, children, height = 300, customContent }) => {
    const isCollapsed = collapsedCharts[id];
    const isExpanded = expandedChart === id;
    return (
      <div className={`bg-white rounded-2xl shadow-lg p-6 ${isExpanded ? 'fixed inset-4 z-50 overflow-auto' : ''}`}>
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-xl font-bold text-gray-800">{title}</h3>
          <div className="flex gap-2">
            <button onClick={() => toggleCollapse(id)} className="p-2 hover:bg-gray-100 rounded-lg transition">
              {isCollapsed ? <ChevronDown className="w-5 h-5" /> : <ChevronUp className="w-5 h-5" />}
            </button>
            <button onClick={() => toggleExpand(id)} className="p-2 hover:bg-gray-100 rounded-lg transition">
              {isExpanded ? <Minimize2 className="w-5 h-5" /> : <Maximize2 className="w-5 h-5" />}
            </button>
          </div>
        </div>
        {!isCollapsed && (
          <>
            {customContent}
            <ResponsiveContainer width="100%" height={isExpanded ? 600 : height}>
              {children}
            </ResponsiveContainer>
          </>
        )}
      </div>
    );
  };

  const KPICard = ({ id, icon: Icon, value, label, subtext, gradient }) => {
    const isCollapsed = collapsedKPIs[id];
    return (
      <div className={`bg-gradient-to-br ${gradient} rounded-2xl shadow-lg p-6 text-white ${isCollapsed ? 'h-16 flex items-center' : ''}`}>
        <div className="flex items-center justify-between">
          {!isCollapsed && (
            <div className="flex-1">
              <div className="flex items-center justify-between mb-2">
                <Icon className="w-8 h-8 opacity-80" />
                <span className="text-4xl font-bold">{value}</span>
              </div>
              <p className="text-white text-opacity-90 font-medium">{label}</p>
              {subtext && <p className="text-xs text-white text-opacity-70 mt-1">{subtext}</p>}
            </div>
          )}
          {isCollapsed && (
             <div className="flex items-center gap-3 flex-1">
                <Icon className="w-6 h-6 opacity-80" />
                <span className="font-bold text-xl">{value}</span>
             </div>
          )}
          <button onClick={() => toggleKPICollapse(id)} className="p-2 hover:bg-white hover:bg-opacity-20 rounded-lg transition ml-2">
            {isCollapsed ? <ChevronDown className="w-4 h-4" /> : <ChevronUp className="w-4 h-4" />}
          </button>
        </div>
      </div>
    );
  };

  if (data.length === 0) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 flex items-center justify-center p-8">
        <div className="bg-white rounded-2xl shadow-xl p-12 max-w-md w-full text-center">
          <Upload className="w-16 h-16 mx-auto mb-6 text-blue-500" />
          <h1 className="text-3xl font-bold text-gray-800 mb-4">Dashboard Inmobiliario</h1>
          <p className="text-gray-600 mb-8">Comienza subiendo tus archivos</p>
          <div className="space-y-4">
            <label className="block">
                <div className="block w-full text-sm text-gray-500 cursor-pointer p-4 border-2 border-dashed border-blue-300 rounded-lg hover:bg-blue-50 text-center transition">
                    <span className="font-semibold text-blue-600">1. Subir LEADS (CSV)</span>
                </div>
                <input type="file" accept=".csv,.tsv" onChange={handleFileUpload} className="hidden" />
            </label>
            {/* Opción para subir Eventos después */}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 p-4 md:p-8">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="bg-white rounded-2xl shadow-lg p-6 mb-6">
          <div className="flex items-center justify-between flex-wrap gap-4 mb-4">
            <div>
              <h1 className="text-3xl font-bold text-gray-800">Dashboard Comercial</h1>
              <p className="text-gray-600 mt-1">{data.length} registros cargados | {marketingEvents.length} eventos</p>
            </div>
            <div className="flex gap-2">
                <label className="cursor-pointer">
                  <input type="file" accept=".csv,.tsv" onChange={handleFileUpload} className="hidden" />
                  <div className="flex items-center gap-2 px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition">
                    <Upload className="w-4 h-4" />
                    <span>Leads</span>
                  </div>
                </label>
                <label className="cursor-pointer">
                  <input type="file" accept=".csv,.tsv" onChange={handleEventsUpload} className="hidden" />
                  <div className="flex items-center gap-2 px-4 py-2 bg-violet-500 text-white rounded-lg hover:bg-violet-600 transition">
                    <Megaphone className="w-4 h-4" />
                    <span>Eventos</span>
                  </div>
                </label>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 items-end">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Desde</label>
              <input type="date" value={filters.startDate} onChange={(e) => setFilters({...filters, startDate: e.target.value})} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500" />
            </div>
            <div className="flex gap-2">
              <div className="flex-1">
                <label className="block text-sm font-medium text-gray-700 mb-1">Hasta</label>
                <input type="date" value={filters.endDate} onChange={(e) => setFilters({...filters, endDate: e.target.value})} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500" />
              </div>
              <button onClick={resetDates} className="mb-[1px] p-2.5 bg-gray-100 text-gray-600 rounded-lg hover:bg-gray-200 transition" title="Limpiar fechas"><RotateCcw size={20} /></button>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Vendedor</label>
              <select value={filters.agente} onChange={(e) => setFilters({ ...filters, agente: e.target.value })} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500">
                {uniqueAgents.map(agent => <option key={agent} value={agent}>{agent}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Fuente</label>
              <select value={filters.fuente} onChange={(e) => setFilters({ ...filters, fuente: e.target.value })} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500">
                <option value="Todas">Todas</option>
                <option value="WhatsApp">WhatsApp</option>
                <option value="Instagram">Instagram</option>
                <option value="Facebook">Facebook</option>
                <option value="Otro">Otro</option>
              </select>
            </div>
          </div>
        </div>

        {/* KPIs */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-6">
          <KPICard id="kpi-leads" icon={Users} value={kpis.funnel.leads} label="Total Leads" gradient="from-blue-500 to-blue-600" />
          <KPICard id="kpi-cotizaciones" icon={Target} value={kpis.cotizacionesActivas} label="Cotizaciones Activas" gradient="from-green-500 to-green-600" />
          <KPICard id="kpi-visitas" icon={Eye} value={kpis.totalVisitas} label="Total Visitas" gradient="from-teal-500 to-teal-600" />
          <KPICard id="kpi-conv1" icon={TrendingUp} value={`${kpis.convLeadToCotiz}%`} label="Lead → Cotización" gradient="from-purple-500 to-purple-600" />
        </div>
        
        {/* KPIs Inversion */}
        {kpis.totalInversion > 0 && (
             <div className="grid grid-cols-1 gap-6 mb-6">
                 <KPICard id="kpi-inv" icon={DollarSign} value={`$${kpis.totalInversion.toLocaleString()}`} label="Inversión Marketing Total" gradient="from-slate-700 to-slate-800" />
             </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
          <KPICard id="ratio-visitas-lead" icon={Eye} value={`${kpis.ratioVisitasLead}%`} label="Ratio Visitas / Leads" subtext={`${kpis.totalVisitas} visitas sobre ${kpis.funnel.leads} leads`} gradient="from-indigo-500 to-indigo-600" />
          <KPICard id="ratio-tuc-showroom" icon={MapPin} value={`${kpis.ratioTucShowroom}%`} label="Ratio Tucumán / Showroom" subtext={`${kpis.visitasShowroom} visitas sobre ${kpis.leadsTucuman} leads Tuc.`} gradient="from-orange-500 to-orange-600" />
          <KPICard id="rel-visita-cotiz" icon={Award} value={`${kpis.porcentajeVisitasConCotiz}%`} label="Visitas con Cotización" subtext={`${kpis.visitantesConCotizacion} de ${kpis.totalVisitas} ya cotizaron`} gradient="from-pink-500 to-pink-600" />
        </div>

        {/* Gráficos */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <ChartContainer id="funnel" title="Embudo de Ventas" height={300}>
            <BarChart data={funnelData}><CartesianGrid strokeDasharray="3 3" /><XAxis dataKey="name" /><YAxis /><Tooltip content={<CustomTooltip total={kpis.funnel.leads} />} /><Bar dataKey="value" radius={[8, 8, 0, 0]}>{funnelData.map((entry, index) => <Cell key={`cell-${index}`} fill={entry.fill} />)}</Bar></BarChart>
          </ChartContainer>

          <ChartContainer id="daily-region" title="Evolución Diaria + Eventos Marketing" height={450}>
            <BarChart data={dailyRegionData} margin={{ bottom: 40 }}> {/* MARGEN SUPERIOR PARA TEXTOS LARGOS */}
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis 
                dataKey="date" 
                tickFormatter={formatDateDisplay} 
                interval="preserveStartEnd"
              />
              <YAxis />
              <Tooltip content={<StackedTooltip />} />
              <Legend wrapperStyle={{ top: 0 }} />
              
              <Bar dataKey="Tucuman" stackId="a" fill="#f59e0b" name="Tucumán" />
              <Bar dataKey="RestoNOA" stackId="a" fill="#3b82f6" name="Resto NOA" />
              <Bar dataKey="RestoPais" stackId="a" fill="#10b981" name="Resto País" />

              {/* LÍNEAS DE EVENTOS (Etiquetas Escaladas Horizontalmente) */}
              {filteredEvents.map((event, idx) => {
                  // Lógica de Escalera Vertical (Carriles)
                  const lane = idx % 3; // 0, 1, 2
                  const verticalOffset = 50 + (lane * 20); // 30px, 50px, 70px

                  return (
                    <ReferenceLine 
                        key={idx} 
                        x={event.dateISO} 
                        stroke={EVENT_COLORS[event.type] || EVENT_COLORS.default}
                        strokeDasharray="3 3"
                        strokeWidth={2} 
                        label={{ 
                            position: 'insideBottom',
                            value: event.name, 
                            fill: EVENT_COLORS[event.type] || EVENT_COLORS.default,
                            fontSize: 11,
                            fontWeight: 'bold',
                            angle: 0, 
                            dy: verticalOffset, // Desplazamiento dinámico para no chocarse
                        }} 
                    />
                  );
              })}
            </BarChart>
          </ChartContainer>

          <ChartContainer id="agent-performance" title="Rendimiento por Vendedor" height={300}>
            <BarChart data={agentPerformance}><CartesianGrid strokeDasharray="3 3" /><XAxis dataKey="name" /><YAxis /><Tooltip content={<CustomTooltip totalMap={{'Leads': kpis.funnel.leads, 'Cotizaciones': kpis.funnel.cotizaciones, 'OfertasComerciales': kpis.funnel.ofertas, 'Ventas': kpis.funnel.ventas}} />} /><Legend /><Bar dataKey="Leads" fill="#3b82f6" radius={[8, 8, 0, 0]} /><Bar dataKey="Cotizaciones" fill="#10b981" radius={[8, 8, 0, 0]} /><Bar dataKey="OfertasComerciales" fill="#f59e0b" radius={[8, 8, 0, 0]} /><Bar dataKey="Ventas" fill="#ef4444" radius={[8, 8, 0, 0]} /></BarChart>
          </ChartContainer>

          <ChartContainer id="geo-distribution" title="Distribución por Provincia (Min. 4)" height={300} customContent={
              <div className="mb-4"><label className="block text-sm font-medium text-gray-700 mb-2">Filtrar por Provincia</label><select value={filters.provincia} onChange={(e) => setFilters({ ...filters, provincia: e.target.value })} className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 bg-white">{uniqueProvincias.map(prov => <option key={prov} value={prov}>{prov}</option>)}</select></div>
          }>
            <BarChart data={geoDistribution}><CartesianGrid strokeDasharray="3 3" /><XAxis dataKey="name" angle={-40} textAnchor="end" height={80} interval={0} /><YAxis /><Tooltip content={<CustomTooltip total={kpis.funnel.leads} />} /><Bar dataKey="value" fill="#8884d8">{geoDistribution.map((entry, index) => <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />)}</Bar></BarChart>
          </ChartContainer>

          <ChartContainer id="provincia-analysis" title="Análisis por Provincia" height={350} customContent={
              <div className="mb-4"><label className="block text-sm font-medium text-gray-700 mb-2">Tipo de Análisis</label><select value={provinciaChartType} onChange={(e) => setProvinciaChartType(e.target.value)} className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 bg-white"><option value="cotizacion">Cotizaciones</option><option value="oferta">Ofertas Comerciales</option><option value="venta">Ventas</option></select></div>
          }>
            <BarChart data={datosPorProvincia}><CartesianGrid strokeDasharray="3 3" /><XAxis dataKey="name" angle={-40} textAnchor="end" height={80} /><YAxis /><Tooltip content={<CustomTooltip total={totalMetricaProvincia} />} /><Bar dataKey="value" fill={provinciaChartType === 'cotizacion' ? '#10b981' : provinciaChartType === 'oferta' ? '#f59e0b' : '#ef4444'} radius={[8, 8, 0, 0]} /></BarChart>
          </ChartContainer>

          <ChartContainer id="visitas-tipo" title="Tipos de Visitas" height={300}>
            <BarChart data={visitasData}><CartesianGrid strokeDasharray="3 3" /><XAxis dataKey="name" /><YAxis /><Tooltip content={<CustomTooltip total={kpis.totalVisitas} />} /><Bar dataKey="value" fill="#8b5cf6" radius={[8, 8, 0, 0]} /></BarChart>
          </ChartContainer>

          <ChartContainer id="visitas-agente" title="Visitas Cerradas por Agente" height={300}>
            <BarChart data={visitasPorAgente}><CartesianGrid strokeDasharray="3 3" /><XAxis dataKey="name" /><YAxis /><Tooltip content={<CustomTooltip total={kpis.totalVisitas} />} /><Bar dataKey="Visitas" fill="#ec4899" radius={[8, 8, 0, 0]} /></BarChart>
          </ChartContainer>

          <ChartContainer id="monthly-trend" title="Tendencia Mensual" height={300}>
            <LineChart data={monthlyTrend}><CartesianGrid strokeDasharray="3 3" /><XAxis dataKey="name" /><YAxis /><Tooltip /><Legend /><Line type="monotone" dataKey="Contactos" stroke="#3b82f6" strokeWidth={3} dot={{ r: 6 }} /></LineChart>
          </ChartContainer>

          <div className="lg:col-span-2">
            <ChartContainer id="social-comparison" title="Comparativa de Canales por Mes" height={300}>
              <BarChart data={socialByMonth}><CartesianGrid strokeDasharray="3 3" /><XAxis dataKey="name" /><YAxis /><Tooltip content={<StackedTooltip />} /><Legend /><Bar dataKey="Instagram" fill="#e4405f" radius={[8, 8, 0, 0]} /><Bar dataKey="Facebook" fill="#1877f2" radius={[8, 8, 0, 0]} /><Bar dataKey="WhatsApp" fill="#25d366" radius={[8, 8, 0, 0]} /><Bar dataKey="Otro" fill="#9ca3af" radius={[8, 8, 0, 0]} /></BarChart>
            </ChartContainer>
          </div>

          <ChartContainer id="weekly-rhythm" title="Ritmo Semanal" height={300}>
            <BarChart data={weeklyRhythm}><CartesianGrid strokeDasharray="3 3" /><XAxis dataKey="name" angle={0} textAnchor="end" height={80} /><YAxis /><Tooltip content={<CustomTooltip total={kpis.funnel.leads} />} /><Bar dataKey="Contactos" fill="#8b5cf6" radius={[8, 8, 0, 0]} /></BarChart>
          </ChartContainer>

          <ChartContainer id="quality-ranking" title="Ranking de Calidad por Canal" height={300}>
            <BarChart data={qualityRanking} layout="vertical"><CartesianGrid strokeDasharray="3 3" /><XAxis type="number" domain={[0, 30]} /><YAxis dataKey="name" type="category" width={100} /><Tooltip formatter={(value, name, props) => { if (name === 'conversionDisplay') { return [`${props.payload.conversion}% (${props.payload.cotizaciones}/${props.payload.leads} leads)`, 'Conversión']; } return value; }} /><Bar dataKey="conversionDisplay" fill="#10b981" radius={[0, 8, 8, 0]} /></BarChart>
          </ChartContainer>
        </div>
      </div>
    </div>
  );
};

export default App;