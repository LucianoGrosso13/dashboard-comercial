import React, { useState, useMemo } from 'react';
import { BarChart, Bar, LineChart, Line, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { Upload, TrendingUp, Users, MapPin, Target, Award, ChevronDown, ChevronUp, Maximize2, Minimize2, Eye } from 'lucide-react';
import Papa from 'papaparse';

const App = () => {
  const [data, setData] = useState([]);
  const [filters, setFilters] = useState({
    agente: 'Todos',
    provincia: 'Todas',
    fuente: 'Todas'
  });
  const [provinciaChartType, setProvinciaChartType] = useState('cotizacion');
  const [collapsedCharts, setCollapsedCharts] = useState({});
  const [collapsedKPIs, setCollapsedKPIs] = useState({});
  const [expandedChart, setExpandedChart] = useState(null);

  const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#14b8a6', '#f97316'];

  // Procesar archivo CSV/TSV
  const handleFileUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: (results) => {
        console.log('Encabezados detectados:', results.meta.fields);
        console.log('Primera fila de datos:', results.data[0]);
        
        const cleanedData = results.data.map(row => ({
          ...row,
          AGENTE: normalizeAgent(row.AGENTE),
          platform: normalizePlatform(row.platform),
          'Provincia Detectada': normalizeProvincia(row['Provincia Detectada']),
          'Tipo de Evento': row['Tipo de Evento']?.trim(),
          fecha: row.fecha?.trim(),
          VISITAS: row.VISITAS?.trim() || ''
        }));
        
        console.log('Datos procesados (primeras 3 filas):', cleanedData.slice(0, 3));
        setData(cleanedData);
      }
    });
  };

  // Normalizar agentes
  const normalizeAgent = (agent) => {
    if (!agent) return '';
    const normalized = agent.trim();
    if (normalized.toUpperCase() === 'PM') return 'Paola';
    if (normalized.toUpperCase() === 'IC') return 'Irina';
    return normalized.charAt(0).toUpperCase() + normalized.slice(1).toLowerCase();
  };

  // Normalizar plataforma
  const normalizePlatform = (platform) => {
    if (!platform) return 'Otro';
    const p = platform.toLowerCase().trim();
    if (p === 'wp' || p === 'whatsapp') return 'WhatsApp';
    if (p === 'ig' || p === 'instagram') return 'Instagram';
    if (p === 'facebook' || p === 'fb') return 'Facebook';
    return 'Otro';
  };

  // Normalizar provincia
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
      return matchAgent && matchProvincia && matchFuente;
    });
  }, [data, filters]);

  // Calcular KPIs mejorados - CORREGIDO
  const kpis = useMemo(() => {
    const leadsCount = filteredData.filter(row => 
      row['Tipo de Evento']?.toLowerCase().includes('lead')
    ).length;
    
    const cotizaciones = filteredData.filter(row => 
      row['Tipo de Evento']?.toLowerCase().includes('cotización') ||
      row['Tipo de Evento']?.toLowerCase().includes('cotizacion')
    ).length;

    const ofertasComerciales = filteredData.filter(row => 
      row['Tipo de Evento']?.toLowerCase().includes('oferta comercial') ||
      row['Tipo de Evento']?.toLowerCase().includes('oferta')
    ).length;

    const ventas = filteredData.filter(row => 
      row['Tipo de Evento']?.toLowerCase().includes('venta')
    ).length;

    // Contar visitas totales
    const totalVisitas = filteredData.filter(row => {
      const visita = row.VISITAS?.toLowerCase().trim();
      return visita === 'showroom' || visita === 'fabrica' || visita === 'ambas';
    }).length;

    // LÓGICA CORREGIDA DEL EMBUDO
    // Total de leads = todos los que entraron (incluyendo los que ya avanzaron)
    const totalLeadsReales = leadsCount + cotizaciones + ofertasComerciales + ventas;
    
    // Total de cotizaciones = las que están en coti + las que ya son oferta + las que ya son venta
    const totalCotizacionesReales = cotizaciones + ofertasComerciales + ventas;
    
    // Total de ofertas = las que están en oferta + las que ya son venta
    const totalOfertasReales = ofertasComerciales + ventas;

    const provinciaCount = {};
    filteredData.forEach(row => {
      const prov = row['Provincia Detectada'] || 'Sin Datos';
      provinciaCount[prov] = (provinciaCount[prov] || 0) + 1;
    });

    const topProvincia = Object.entries(provinciaCount).sort((a, b) => b[1] - a[1])[0];

    // Tasas de conversión corregidas
    // Lead → Cotización: del total de leads que entraron, cuántos llegaron a cotización
    const convLeadToCotiz = totalLeadsReales > 0 ? ((totalCotizacionesReales / totalLeadsReales) * 100).toFixed(1) : 0;
    
    // Cotización → Oferta: del total de cotizaciones, cuántas llegaron a oferta
    const convCotizToOferta = totalCotizacionesReales > 0 ? ((totalOfertasReales / totalCotizacionesReales) * 100).toFixed(1) : 0;
    
    // Oferta → Venta: del total de ofertas, cuántas se convirtieron en venta
    const convOfertaToVenta = totalOfertasReales > 0 ? ((ventas / totalOfertasReales) * 100).toFixed(1) : 0;

    return {
      leads: leadsCount,
      cotizaciones,
      ofertasComerciales,
      ventas,
      totalVisitas,
      totalLeads: totalLeadsReales,
      convLeadToCotiz,
      convCotizToOferta,
      convOfertaToVenta,
      topProvincia: topProvincia ? topProvincia[0] : 'N/A'
    };
  }, [filteredData]);

  // Obtener opciones únicas para filtros
  const uniqueAgents = useMemo(() => {
    const agents = [...new Set(data.map(row => row.AGENTE))].filter(Boolean);
    return ['Todos', ...agents];
  }, [data]);

  const uniqueProvincias = useMemo(() => {
    const provincias = [...new Set(data.map(row => row['Provincia Detectada']))].filter(Boolean);
    return ['Todas', ...provincias];
  }, [data]);

  // Datos para embudo mejorado
  const funnelData = [
    { name: 'Leads', value: kpis.leads, fill: '#3b82f6' },
    { name: 'Cotizaciones', value: kpis.cotizaciones, fill: '#10b981' },
    { name: 'Ofertas Comerciales', value: kpis.ofertasComerciales, fill: '#f59e0b' },
    { name: 'Ventas', value: kpis.ventas, fill: '#ef4444' }
  ];

  // Rendimiento por vendedor mejorado
  const agentPerformance = useMemo(() => {
    const agentStats = {};
    filteredData.forEach(row => {
      const agent = row.AGENTE || 'Sin Agente';
      if (!agentStats[agent]) {
        agentStats[agent] = { name: agent, Leads: 0, Cotizaciones: 0, OfertasComerciales: 0, Ventas: 0 };
      }
      if (row['Tipo de Evento']?.toLowerCase().includes('lead')) {
        agentStats[agent].Leads++;
      }
      if (row['Tipo de Evento']?.toLowerCase().includes('cotización') || 
          row['Tipo de Evento']?.toLowerCase().includes('cotizacion')) {
        agentStats[agent].Cotizaciones++;
      }
      if (row['Tipo de Evento']?.toLowerCase().includes('oferta comercial') || 
          row['Tipo de Evento']?.toLowerCase().includes('oferta')) {
        agentStats[agent].OfertasComerciales++;
      }
      if (row['Tipo de Evento']?.toLowerCase().includes('venta')) {
        agentStats[agent].Ventas++;
      }
    });
    return Object.values(agentStats);
  }, [filteredData]);

  // Distribución geográfica
  const geoDistribution = useMemo(() => {
    const provinciaCounts = {};
    filteredData.forEach(row => {
      const prov = row['Provincia Detectada']?.trim() || 'Sin Datos';
      provinciaCounts[prov] = (provinciaCounts[prov] || 0) + 1;
    });

    let otroCount = 0;
    const mainProvincias = [];

    Object.entries(provinciaCounts).forEach(([prov, count]) => {
      if (prov.toLowerCase() === 'otro' || count < 10) {
        otroCount += count;
      } else {
        mainProvincias.push({ name: prov, value: count });
      }
    });

    if (otroCount > 0) {
      mainProvincias.push({ name: 'Otro', value: otroCount });
    }

    return mainProvincias.sort((a, b) => b.value - a.value);
  }, [filteredData]);

  // Datos por provincia según tipo seleccionado
  const datosPorProvincia = useMemo(() => {
    const provinciaCounts = {};
    filteredData.forEach(row => {
      let incluir = false;
      if (provinciaChartType === 'cotizacion' && 
          (row['Tipo de Evento']?.toLowerCase().includes('cotización') || 
           row['Tipo de Evento']?.toLowerCase().includes('cotizacion'))) {
        incluir = true;
      } else if (provinciaChartType === 'oferta' && 
                 (row['Tipo de Evento']?.toLowerCase().includes('oferta comercial') ||
                  row['Tipo de Evento']?.toLowerCase().includes('oferta'))) {
        incluir = true;
      } else if (provinciaChartType === 'venta' && 
                 row['Tipo de Evento']?.toLowerCase().includes('venta')) {
        incluir = true;
      }

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

  // Análisis de visitas - CORREGIDO
  const visitasData = useMemo(() => {
    const visitaCounts = { 'Showroom': 0, 'Fábrica': 0, 'Ambas': 0 };
    
    filteredData.forEach(row => {
      const visita = row.VISITAS?.toLowerCase().trim();
      
      if (visita === 'showroom') {
        visitaCounts['Showroom']++;
      } else if (visita === 'fabrica') {
        visitaCounts['Fábrica']++;
      } else if (visita === 'ambas') {
        visitaCounts['Ambas']++;
      }
    });
    
    console.log('Conteo de visitas:', visitaCounts);
    
    return Object.entries(visitaCounts)
      .map(([name, value]) => ({ name, value }))
      .filter(item => item.value > 0);
  }, [filteredData]);

  // Visitas cerradas por agente - CORREGIDO
  const visitasPorAgente = useMemo(() => {
    const agentVisitas = {};
    
    filteredData.forEach(row => {
      const visita = row.VISITAS?.toLowerCase().trim();
      // Solo contar si hay una visita válida (showroom, fabrica o ambas)
      if (visita === 'showroom' || visita === 'fabrica' || visita === 'ambas') {
        const agent = row.AGENTE || 'Sin Agente';
        agentVisitas[agent] = (agentVisitas[agent] || 0) + 1;
      }
    });
    
    console.log('Visitas por agente:', agentVisitas);
    
    return Object.entries(agentVisitas)
      .map(([name, value]) => ({ name, Visitas: value }))
      .sort((a, b) => b.Visitas - a.Visitas);
  }, [filteredData]);

  // Tendencia mensual
  const monthlyTrend = useMemo(() => {
    const monthCounts = {};
    filteredData.forEach(row => {
      if (row.fecha) {
        const parts = row.fecha.split('/');
        if (parts.length === 3) {
          const month = `${parts[1]}/${parts[2]}`;
          monthCounts[month] = (monthCounts[month] || 0) + 1;
        }
      }
    });
    
    const result = Object.entries(monthCounts)
      .map(([name, value]) => ({ name, Contactos: value }))
      .sort((a, b) => {
        const [m1, y1] = a.name.split('/');
        const [m2, y2] = b.name.split('/');
        return new Date(y1, m1 - 1) - new Date(y2, m2 - 1);
      });
    
    return result;
  }, [filteredData]);

  // Comparativa de redes sociales por mes
  const socialByMonth = useMemo(() => {
    const monthPlatform = {};
    const totals = { Instagram: 0, Facebook: 0, WhatsApp: 0, Otro: 0 };

    filteredData.forEach(row => {
      if (row.fecha) {
        const parts = row.fecha.split('/');
        if (parts.length === 3) {
          const month = `${parts[1]}/${parts[2]}`;
          if (!monthPlatform[month]) {
            monthPlatform[month] = { name: month, Instagram: 0, Facebook: 0, WhatsApp: 0, Otro: 0 };
          }
          const platform = row.platform || 'Otro';
          if (['Instagram', 'Facebook', 'WhatsApp', 'Otro'].includes(platform)) {
            monthPlatform[month][platform]++;
            totals[platform]++;
          }
        }
      }
    });

    const sorted = Object.values(monthPlatform).sort((a, b) => {
      const [m1, y1] = a.name.split('/');
      const [m2, y2] = b.name.split('/');
      return new Date(y1, m1 - 1) - new Date(y2, m2 - 1);
    });

    sorted.push({
      name: 'TOTAL',
      Instagram: totals.Instagram,
      Facebook: totals.Facebook,
      WhatsApp: totals.WhatsApp,
      Otro: totals.Otro
    });

    return sorted;
  }, [filteredData]);

  // Ritmo semanal
  const weeklyRhythm = useMemo(() => {
    const dayNames = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];
    const dayCounts = { Lunes: 0, Martes: 0, Miércoles: 0, Jueves: 0, Viernes: 0, Sábado: 0, Domingo: 0 };

    filteredData.forEach(row => {
      if (row.fecha) {
        const parts = row.fecha.split('/');
        if (parts.length === 3) {
          const date = new Date(parts[2], parts[1] - 1, parts[0]);
          if (!isNaN(date.getTime())) {
            const dayName = dayNames[date.getDay()];
            if (dayName) {
              dayCounts[dayName]++;
            }
          }
        }
      }
    });

    return Object.entries(dayCounts)
      .filter(([name]) => name && name !== 'undefined')
      .map(([name, value]) => ({ name, Contactos: value }));
  }, [filteredData]);

  // Ranking de calidad
  const qualityRanking = useMemo(() => {
    const platformStats = {};

    filteredData.forEach(row => {
      const platform = row.platform || 'Otro';
      if (!platformStats[platform]) {
        platformStats[platform] = { leads: 0, cotizaciones: 0 };
      }

      if (row['Tipo de Evento']?.toLowerCase().includes('lead')) {
        platformStats[platform].leads++;
      }
      if (row['Tipo de Evento']?.toLowerCase().includes('cotización') || 
          row['Tipo de Evento']?.toLowerCase().includes('cotizacion')) {
        platformStats[platform].cotizaciones++;
      }
    });

    const ranking = Object.entries(platformStats).map(([name, stats]) => {
      let conversion = 0;
      if (stats.cotizaciones > 0 && stats.leads === 0) {
        conversion = 100;
      } else if (stats.leads > 0) {
        conversion = (stats.cotizaciones / stats.leads) * 100;
      }

      const conversionReal = parseFloat(conversion.toFixed(1));

      return {
        name,
        conversion: conversionReal,
        conversionDisplay: Math.min(conversionReal, 30),
        leads: stats.leads,
        cotizaciones: stats.cotizaciones
      };
    });

    return ranking
      .filter(item => item.leads > 0 || item.cotizaciones > 0)
      .sort((a, b) => b.conversion - a.conversion);
  }, [filteredData]);

  const toggleCollapse = (chartId) => {
    setCollapsedCharts(prev => ({
      ...prev,
      [chartId]: !prev[chartId]
    }));
  };

  const toggleKPICollapse = (kpiId) => {
    setCollapsedKPIs(prev => ({
      ...prev,
      [kpiId]: !prev[kpiId]
    }));
  };

  const toggleExpand = (chartId) => {
    setExpandedChart(expandedChart === chartId ? null : chartId);
  };

  const ChartContainer = ({ id, title, children, height = 300, customContent }) => {
    const isCollapsed = collapsedCharts[id];
    const isExpanded = expandedChart === id;

    return (
      <div className={`bg-white rounded-2xl shadow-lg p-6 ${isExpanded ? 'fixed inset-4 z-50 overflow-auto' : ''}`}>
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-xl font-bold text-gray-800">{title}</h3>
          <div className="flex gap-2">
            <button
              onClick={() => toggleCollapse(id)}
              className="p-2 hover:bg-gray-100 rounded-lg transition"
              title={isCollapsed ? "Expandir" : "Contraer"}
            >
              {isCollapsed ? <ChevronDown className="w-5 h-5" /> : <ChevronUp className="w-5 h-5" />}
            </button>
            <button
              onClick={() => toggleExpand(id)}
              className="p-2 hover:bg-gray-100 rounded-lg transition"
              title={isExpanded ? "Minimizar" : "Maximizar"}
            >
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

  const KPICard = ({ id, icon: Icon, value, label, gradient }) => {
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
            </div>
          )}
          {isCollapsed && (
            <div className="flex items-center gap-3 flex-1">
              <Icon className="w-6 h-6 opacity-80" />
              <span className="font-bold text-xl">{value}</span>
              <span className="text-sm opacity-90">{label}</span>
            </div>
          )}
          <button
            onClick={() => toggleKPICollapse(id)}
            className="p-2 hover:bg-white hover:bg-opacity-20 rounded-lg transition ml-2"
            title={isCollapsed ? "Expandir" : "Contraer"}
          >
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
          <p className="text-gray-600 mb-8">Sube tu archivo CSV o TSV para comenzar el análisis</p>
          <label className="block">
            <input
              type="file"
              accept=".csv,.tsv"
              onChange={handleFileUpload}
              className="block w-full text-sm text-gray-500 file:mr-4 file:py-3 file:px-6 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100 cursor-pointer"
            />
          </label>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 p-4 md:p-8">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="bg-white rounded-2xl shadow-lg p-6 mb-6">
          <div className="flex items-center justify-between flex-wrap gap-4">
            <div>
              <h1 className="text-3xl font-bold text-gray-800">Dashboard Comercial</h1>
              <p className="text-gray-600 mt-1">{data.length} registros cargados</p>
            </div>
            <label className="cursor-pointer">
              <input type="file" accept=".csv,.tsv" onChange={handleFileUpload} className="hidden" />
              <div className="flex items-center gap-2 px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition">
                <Upload className="w-4 h-4" />
                <span>Cambiar archivo</span>
              </div>
            </label>
          </div>

          {/* Filtros */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Vendedor</label>
              <select
                value={filters.agente}
                onChange={(e) => setFilters({ ...filters, agente: e.target.value })}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                {uniqueAgents.map(agent => (
                  <option key={agent} value={agent}>{agent}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Fuente</label>
              <select
                value={filters.fuente}
                onChange={(e) => setFilters({ ...filters, fuente: e.target.value })}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value="Todas">Todas</option>
                <option value="WhatsApp">WhatsApp</option>
                <option value="Instagram">Instagram</option>
                <option value="Facebook">Facebook</option>
                <option value="Otro">Otro</option>
              </select>
            </div>
          </div>
        </div>

        {/* KPIs principales */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-6">
          <KPICard 
            id="kpi-leads"
            icon={Users}
            value={kpis.leads}
            label="Total Leads"
            gradient="from-blue-500 to-blue-600"
          />
          <KPICard 
            id="kpi-cotizaciones"
            icon={Target}
            value={kpis.cotizaciones}
            label="Total Cotizaciones"
            gradient="from-green-500 to-green-600"
          />
          <KPICard 
            id="kpi-ofertas"
            icon={Award}
            value={kpis.ofertasComerciales}
            label="Ofertas Comerciales"
            gradient="from-orange-500 to-orange-600"
          />
          <KPICard 
            id="kpi-ventas"
            icon={TrendingUp}
            value={kpis.ventas}
            label="Ventas Cerradas"
            gradient="from-red-500 to-red-600"
          />
        </div>

        {/* KPI de visitas y conversiones */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-6">
          <KPICard 
            id="kpi-visitas"
            icon={Eye}
            value={kpis.totalVisitas}
            label="Total Visitas"
            gradient="from-teal-500 to-teal-600"
          />
          <KPICard 
            id="kpi-conv1"
            icon={TrendingUp}
            value={`${kpis.convLeadToCotiz}%`}
            label="Lead → Cotización"
            gradient="from-purple-500 to-purple-600"
          />
          <KPICard 
            id="kpi-conv2"
            icon={TrendingUp}
            value={`${kpis.convCotizToOferta}%`}
            label="Cotización → Oferta"
            gradient="from-indigo-500 to-indigo-600"
          />
          <KPICard 
            id="kpi-conv3"
            icon={TrendingUp}
            value={`${kpis.convOfertaToVenta}%`}
            label="Oferta → Venta"
            gradient="from-pink-500 to-pink-600"
          />
        </div>

        {/* Gráficos */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Embudo mejorado */}
          <ChartContainer id="funnel" title="Embudo de Ventas" height={300}>
            <BarChart data={funnelData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="name" />
              <YAxis />
              <Tooltip />
              <Bar dataKey="value" radius={[8, 8, 0, 0]}>
                {funnelData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.fill} />
                ))}
              </Bar>
            </BarChart>
          </ChartContainer>

          {/* Rendimiento por vendedor mejorado */}
<ChartContainer id="agent-performance" title="Rendimiento por Vendedor" height={300}>
  <BarChart data={agentPerformance}>
    <CartesianGrid strokeDasharray="3 3" />
    <XAxis dataKey="name" />
    <YAxis />
    <Tooltip />
    <Legend />
    <Bar dataKey="Leads" fill="#3b82f6" radius={[8, 8, 0, 0]} />
    <Bar dataKey="Cotizaciones" fill="#10b981" radius={[8, 8, 0, 0]} />
    <Bar dataKey="OfertasComerciales" fill="#f59e0b" radius={[8, 8, 0, 0]} />
    <Bar dataKey="Ventas" fill="#ef4444" radius={[8, 8, 0, 0]} />
  </BarChart>
</ChartContainer>

<ChartContainer 
  id="geo-distribution" 
  title="Distribución por Provincia" 
  height={300}
  customContent={
    <div className="mb-4">
      <label className="block text-sm font-medium text-gray-700 mb-2">Filtrar por Provincia</label>
      <select
        value={filters.provincia}
        onChange={(e) => setFilters({ ...filters, provincia: e.target.value })}
        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white"
      >
        {uniqueProvincias.map(prov => (
          <option key={prov} value={prov}>{prov}</option>
        ))}
      </select>
    </div>
  }
>
  <PieChart>
    <Pie
      data={geoDistribution}
      cx="50%"
      cy="50%"
      innerRadius={60}
      outerRadius={100}
      paddingAngle={2}
      dataKey="value"
      label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
    >
      {geoDistribution.map((entry, index) => (
        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
      ))}
    </Pie>
    <Tooltip />
  </PieChart>
</ChartContainer>

{/* Datos por provincia con selector */}
<ChartContainer 
  id="provincia-analysis" 
  title="Análisis por Provincia" 
  height={350}
  customContent={
    <div className="mb-4">
      <label className="block text-sm font-medium text-gray-700 mb-2">Tipo de Análisis</label>
      <select
        value={provinciaChartType}
        onChange={(e) => setProvinciaChartType(e.target.value)}
        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white"
      >
        <option value="cotizacion">Cotizaciones</option>
        <option value="oferta">Ofertas Comerciales</option>
        <option value="venta">Ventas</option>
      </select>
    </div>
  }
>
  <BarChart data={datosPorProvincia}>
    <CartesianGrid strokeDasharray="3 3" />
    <XAxis dataKey="name" angle={-40} textAnchor="end" height={80} />
    <YAxis />
    <Tooltip />
    <Bar 
      dataKey="value" 
      fill={provinciaChartType === 'cotizacion' ? '#10b981' : provinciaChartType === 'oferta' ? '#f59e0b' : '#ef4444'} 
      radius={[8, 8, 0, 0]} 
    />
  </BarChart>
</ChartContainer>

{/* Análisis de visitas */}
<ChartContainer id="visitas-tipo" title="Tipos de Visitas" height={300}>
  <BarChart data={visitasData}>
    <CartesianGrid strokeDasharray="3 3" />
    <XAxis dataKey="name" />
    <YAxis />
    <Tooltip />
    <Bar dataKey="value" fill="#8b5cf6" radius={[8, 8, 0, 0]} />
  </BarChart>
</ChartContainer>

{/* Visitas por agente */}
<ChartContainer id="visitas-agente" title="Visitas Cerradas por Agente" height={300}>
  <BarChart data={visitasPorAgente}>
    <CartesianGrid strokeDasharray="3 3" />
    <XAxis dataKey="name" />
    <YAxis />
    <Tooltip />
    <Bar dataKey="Visitas" fill="#ec4899" radius={[8, 8, 0, 0]} />
  </BarChart>
</ChartContainer>

{/* Tendencia mensual */}
<ChartContainer id="monthly-trend" title="Tendencia Mensual" height={300}>
  <LineChart data={monthlyTrend}>
    <CartesianGrid strokeDasharray="3 3" />
    <XAxis dataKey="name" />
    <YAxis />
    <Tooltip />
    <Legend />
    <Line type="monotone" dataKey="Contactos" stroke="#3b82f6" strokeWidth={3} dot={{ r: 6 }} />
  </LineChart>
</ChartContainer>

{/* Comparativa redes sociales */}
<div className="lg:col-span-2">
  <ChartContainer id="social-comparison" title="Comparativa de Canales por Mes" height={300}>
    <BarChart data={socialByMonth}>
      <CartesianGrid strokeDasharray="3 3" />
      <XAxis dataKey="name" />
      <YAxis />
      <Tooltip />
      <Legend />
      <Bar dataKey="Instagram" fill="#e4405f" radius={[8, 8, 0, 0]} />
      <Bar dataKey="Facebook" fill="#1877f2" radius={[8, 8, 0, 0]} />
      <Bar dataKey="WhatsApp" fill="#25d366" radius={[8, 8, 0, 0]} />
      <Bar dataKey="Otro" fill="#9ca3af" radius={[8, 8, 0, 0]} />
    </BarChart>
  </ChartContainer>
</div>

{/* Ritmo semanal */}
<ChartContainer id="weekly-rhythm" title="Ritmo Semanal" height={300}>
  <BarChart data={weeklyRhythm}>
    <CartesianGrid strokeDasharray="3 3" />
    <XAxis dataKey="name" angle={0} textAnchor="end" height={80} />
    <YAxis />
    <Tooltip />
    <Bar dataKey="Contactos" fill="#8b5cf6" radius={[8, 8, 0, 0]} />
  </BarChart>
</ChartContainer>

{/* Ranking de calidad */}
<ChartContainer id="quality-ranking" title="Ranking de Calidad por Canal" height={300}>
  <BarChart data={qualityRanking} layout="vertical">
    <CartesianGrid strokeDasharray="3 3" />
    <XAxis type="number" domain={[0, 30]} />
    <YAxis dataKey="name" type="category" width={100} />
    <Tooltip 
      formatter={(value, name, props) => {
        if (name === 'conversionDisplay') {
          return [`${props.payload.conversion}% (${props.payload.cotizaciones}/${props.payload.leads} leads)`, 'Conversión'];
        }
        return value;
      }}
    />
    <Bar dataKey="conversionDisplay" fill="#10b981" radius={[0, 8, 8, 0]} />
  </BarChart>
</ChartContainer>
</div>
</div> </div> ); }; export default App