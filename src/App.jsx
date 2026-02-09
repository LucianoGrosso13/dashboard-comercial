import React, { useState, useMemo } from 'react';
import { BarChart, Bar, LineChart, Line, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, ReferenceLine } from 'recharts';
import { Upload, TrendingUp, Users, MapPin, Target, Award, ChevronDown, ChevronUp, Maximize2, Minimize2, Eye, Calendar, RotateCcw, Megaphone, DollarSign, Filter } from 'lucide-react';
import Papa from 'papaparse';

// --- Helpers de Fecha y Moneda ---

const parseDateToISO = (dateStr, fallbackDate = '') => {
  if (!dateStr) return fallbackDate;
  const cleanStr = dateStr.toString().trim();
  
  if (cleanStr.match(/^\d{4}-\d{2}-\d{2}$/)) return cleanStr;
  
  if (cleanStr.toUpperCase().includes(' AL ')) {
      const parts = cleanStr.toUpperCase().split(' AL ');
      const startDatePart = parts[0].trim();
      const endParts = parts[1].trim().split('/');
      let month, year;
      if (endParts.length >= 2) {
          month = endParts[endParts.length - 2];
          year = parseInt(month) === 12 ? '2025' : '2026';
      }
      let day = startDatePart.split('/')[0];
      const pad = (n) => n.toString().padStart(2, '0');
      return `${year}-${pad(month)}-${pad(day)}`;
  }

  const slashParts = cleanStr.replace(/-/g, '/').split('/');
  if (slashParts.length >= 2) {
      let day, month, year;
      if(slashParts[0].length === 4) {
          year = slashParts[0];
          month = slashParts[1];
          day = slashParts[2];
      } else {
          day = slashParts[0];
          month = slashParts[1];
          year = slashParts.length === 3 ? slashParts[2] : (parseInt(slashParts[1]) === 12 ? '2025' : '2026');
      }
      const pad = (n) => n.toString().padStart(2, '0');
      return `${year}-${pad(month)}-${pad(day)}`;
  }
  
  return fallbackDate;
};

const parseCurrency = (val) => {
    if (!val) return 0;
    if (typeof val === 'number') return val;
    let clean = val.toString().replace('$', '').replace(/\s/g, '');
    
    if (clean.includes(',') && clean.includes('.')) {
        if (clean.lastIndexOf('.') > clean.lastIndexOf(',')) {
             clean = clean.replace(/,/g, ''); 
        } else {
             clean = clean.replace(/\./g, '').replace(',', '.'); 
        }
    } else if (clean.includes(',')) {
        clean = clean.replace(',', '.');
    }
    
    return parseFloat(clean) || 0;
};

const formatDateDisplay = (isoDate) => {
  if (!isoDate) return '';
  const parts = isoDate.split('-');
  return `${parts[2]}/${parts[1]}`;
};

const App = () => {
  const [data, setData] = useState([]);
  const [marketingEvents, setMarketingEvents] = useState([]);
  const [dailyCampaignData, setDailyCampaignData] = useState([]);
  const [dailyReachData, setDailyReachData] = useState([]);
  const [dailyProvinceReachData, setDailyProvinceReachData] = useState([]);
  
  const [filters, setFilters] = useState({
    agente: 'Todos',
    provincia: 'Todas',
    fuente: 'Todas',
    startDate: '',
    endDate: ''
  });
  const [provinciaChartType, setProvinciaChartType] = useState('cotizacion');
  const [selectedCampaign, setSelectedCampaign] = useState('Todas');
  
  // Nuevo estado para alternar la vista del gráfico unificado
  const [agentViewMode, setAgentViewMode] = useState('channel'); // 'channel' o 'region'

  const [collapsedCharts, setCollapsedCharts] = useState({});
  const [collapsedKPIs, setCollapsedKPIs] = useState({});
  const [expandedChart, setExpandedChart] = useState(null);

  const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#14b8a6', '#f97316'];
  
  const PROVINCE_COLORS = {
    'Tucumán': '#ef4444',
    'Tucuman': '#ef4444',
    'Córdoba': '#3b82f6',
    'Cordoba': '#3b82f6',
    'Santiago del Estero': '#10b981',
    'Salta': '#f59e0b',
    'Jujuy': '#8b5cf6',
    'Catamarca': '#ec4899',
    'La Rioja': '#14b8a6',
    'default': '#6b7280'
  };
  
  const EVENT_COLORS = {
    'pauta': '#ef4444',
    'organico': '#10b981',
    'evento': '#8b5cf6',
    'offline': '#6b7280',
    'email': '#3b82f6',
    'leads': '#ef4444', 
    'branding': '#f59e0b',
    'visitas': '#8b5cf6',
    'seguidores': '#14b8a6',
    'default': '#f59e0b'
  };

  const getCampaignColor = (campaignName) => {
    const colors = {
      'BRANDING-ANDINE': '#ef4444',
      'anuncio de Clientes potenciales': '#10b981',
      'Nuevo anuncio de Clientes potenciales': '#10b981',
      'SEGUIDORES IG Anuncio': '#f59e0b',
      'VISITAS SHOWROOM': '#3b82f6',
      'venta producto showroom': '#8b5cf6'
    };
    const normalized = campaignName.trim();
    if (colors[normalized]) return colors[normalized];
    for (const [key, color] of Object.entries(colors)) {
      if (normalized.includes(key) || key.includes(normalized)) return color;
    }
    const index = normalized.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
    const defaultColors = ['#14b8a6', '#ec4899', '#f97316', '#06b6d4', '#84cc16'];
    return defaultColors[index % defaultColors.length];
  };

  const getProvinceGroup = (provinceName) => {
    if (!provinceName) return 'Resto del País';
    const prov = provinceName.toLowerCase();
    if (prov.includes('tucum') || prov.includes('tucumán')) return 'Tucumán';
    if (prov.includes('córdoba') || prov.includes('cordoba')) return 'Córdoba';
    if (prov.includes('mendoza')) return 'Mendoza';
    const noaProvs = ['salta', 'jujuy', 'santiago', 'catamarca', 'rioja', 'la rioja'];
    if (noaProvs.some(p => prov.includes(p))) return 'Resto del NOA';
    return 'Resto del País';
  };

  const GROUPED_PROVINCE_COLORS = {
    'Tucumán': '#ef4444',
    'Resto del NOA': '#f59e0b',
    'Córdoba': '#3b82f6',
    'Mendoza': '#8b5cf6',
    'Resto del País': '#10b981'
  };

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
        let processedEvents = [];
        let dailyCampaigns = [];
        let dailyReach = [];
        let dailyProvinceReach = [];
        
        const isDailyMetaReport = results.meta.fields.includes('Inicio del informe') && results.meta.fields.includes('Nombre del anuncio');

        if (isDailyMetaReport) {
            const adGroups = {};
            const dailyInvestmentData = {};
            const dailyReachByRegion = {};
            const dailyReachByProvince = {};
            const dailyReachByProvinceAndCampaign = {};
            
            results.data.forEach(row => {
                const name = row['Nombre del anuncio'] || row['Nombre de la campaña'];
                const dateVal = row['Inicio del informe'];
                const cost = parseCurrency(row['Importe gastado (ARS)'] || row['Importe gastado']);
                const reach = parseInt(row['Alcance']) || 0;
                const region = row['Región'] || 'Sin datos';
                
                if (!name || !dateVal) return;
                const dateISO = parseDateToISO(dateVal);
                
                if (!dailyInvestmentData[dateISO]) dailyInvestmentData[dateISO] = {};
                if (!dailyInvestmentData[dateISO][name]) dailyInvestmentData[dateISO][name] = 0;
                dailyInvestmentData[dateISO][name] += cost;
                
                if (!dailyReachByRegion[dateISO]) dailyReachByRegion[dateISO] = {};
                if (!dailyReachByRegion[dateISO][name]) dailyReachByRegion[dateISO][name] = {};
                if (!dailyReachByRegion[dateISO][name][region]) dailyReachByRegion[dateISO][name][region] = 0;
                dailyReachByRegion[dateISO][name][region] += reach;
                
                if (!dailyReachByProvince[dateISO]) dailyReachByProvince[dateISO] = {};
                if (!dailyReachByProvince[dateISO][region]) dailyReachByProvince[dateISO][region] = 0;
                dailyReachByProvince[dateISO][region] += reach;
                
                if (!dailyReachByProvinceAndCampaign[dateISO]) dailyReachByProvinceAndCampaign[dateISO] = {};
                if (!dailyReachByProvinceAndCampaign[dateISO][name]) dailyReachByProvinceAndCampaign[dateISO][name] = {};
                if (!dailyReachByProvinceAndCampaign[dateISO][name][region]) dailyReachByProvinceAndCampaign[dateISO][name][region] = 0;
                dailyReachByProvinceAndCampaign[dateISO][name][region] += reach;
                
                if (!adGroups[name]) {
                    adGroups[name] = {
                        name: name,
                        startDate: dateISO,
                        totalInvestment: 0,
                        type: 'pauta'
                    };
                    const nameLower = name.toLowerCase();
                    if (nameLower.includes('visita')) adGroups[name].type = 'visitas';
                    else if (nameLower.includes('seguidor')) adGroups[name].type = 'seguidores';
                    else if (nameLower.includes('brand')) adGroups[name].type = 'branding';
                    else if (nameLower.includes('lead')) adGroups[name].type = 'leads';
                }
                if (dateISO < adGroups[name].startDate) adGroups[name].startDate = dateISO;
                adGroups[name].totalInvestment += cost;
            });

            processedEvents = Object.values(adGroups).map(group => ({
                dateISO: group.startDate,
                name: group.name,
                type: group.type,
                platform: 'Meta Ads',
                investment: group.totalInvestment
            }));

            dailyCampaigns = Object.entries(dailyInvestmentData).map(([date, campaigns]) => ({
                date,
                displayDate: formatDateDisplay(date),
                ...campaigns
            })).sort((a, b) => a.date.localeCompare(b.date));

            dailyReach = Object.entries(dailyReachByRegion).map(([date, campaigns]) => {
                const dayData = { date, displayDate: formatDateDisplay(date) };
                Object.entries(campaigns).forEach(([campaign, regions]) => {
                    dayData[campaign] = Object.values(regions).reduce((sum, reach) => sum + reach, 0);
                });
                return dayData;
            }).sort((a, b) => a.date.localeCompare(b.date));

            dailyProvinceReach = Object.entries(dailyReachByProvinceAndCampaign).map(([date, campaigns]) => ({
                date,
                displayDate: formatDateDisplay(date),
                campaigns: campaigns
            })).sort((a, b) => a.date.localeCompare(b.date));

        } else {
            processedEvents = results.data.map(row => {
                let dateVal, nameVal, typeVal, platformVal, investmentVal;
                if (row['CAMPAÑAS ACTIVAS '] || row['CAMPAÑAS ACTIVAS']) {
                    dateVal = row['FECHA CIRCULACIÓN '] || row['FECHA CIRCULACIÓN'];
                    nameVal = row['COMENTARIOS'] || row['CAMPAÑAS ACTIVAS '] || 'Campaña';
                    typeVal = row['CAMPAÑAS ACTIVAS '] || 'pauta';
                    platformVal = 'Meta Ads';
                    investmentVal = row['GASTO TOTAL'] || row['INVERSIÓN DIARIA'];
                } else {
                    dateVal = row['Fecha'] || row['fecha'];
                    nameVal = row['Nombre del Evento'] || row['Nombre'] || row['Evento'];
                    typeVal = row['Tipo'] || row['Categoria'];
                    platformVal = row['Plataforma'] || row['Medio'];
                    investmentVal = row['Inversion'] || 0;
                }
                const dateISO = parseDateToISO(dateVal);
                if (!dateISO || !nameVal) return null;

                let cleanType = 'default';
                const typeLower = (typeVal || 'default').toLowerCase();
                if (typeLower.includes('lead')) cleanType = 'leads';
                else if (typeLower.includes('brand')) cleanType = 'branding';
                else if (typeLower.includes('visita')) cleanType = 'visitas';
                else if (typeLower.includes('organico')) cleanType = 'organico';
                else if (typeLower.includes('pauta')) cleanType = 'pauta';

                return {
                    dateISO,
                    name: nameVal,
                    type: cleanType,
                    platform: platformVal,
                    investment: parseCurrency(investmentVal)
                };
            }).filter(Boolean);
        }
        processedEvents.sort((a, b) => a.dateISO.localeCompare(b.dateISO));
        setMarketingEvents(processedEvents);
        setDailyCampaignData(dailyCampaigns);
        setDailyReachData(dailyReach);
        setDailyProvinceReachData(dailyProvinceReach);
      }
    });
  };

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

  const filteredDailyCampaigns = useMemo(() => {
      return dailyCampaignData.filter(day => {
          if (filters.startDate && day.date < filters.startDate) return false;
          if (filters.endDate && day.date > filters.endDate) return false;
          return true;
      });
  }, [dailyCampaignData, filters.startDate, filters.endDate]);

  const filteredDailyReach = useMemo(() => {
      return dailyReachData.filter(day => {
          if (filters.startDate && day.date < filters.startDate) return false;
          if (filters.endDate && day.date > filters.endDate) return false;
          return true;
      });
  }, [dailyReachData, filters.startDate, filters.endDate]);

  const filteredDailyProvinceReach = useMemo(() => {
      return dailyProvinceReachData
          .filter(day => {
              if (filters.startDate && day.date < filters.startDate) return false;
              if (filters.endDate && day.date > filters.endDate) return false;
              return true;
          })
          .map(day => {
              const result = {
                  date: day.date,
                  displayDate: day.displayDate,
                  'Tucumán': 0,
                  'Resto del NOA': 0,
                  'Córdoba': 0,
                  'Mendoza': 0,
                  'Resto del País': 0
              };
              if (day.campaigns) {
                  if (selectedCampaign === 'Todas') {
                      Object.values(day.campaigns).forEach(provinces => {
                          Object.entries(provinces).forEach(([province, reach]) => {
                              const group = getProvinceGroup(province);
                              result[group] += reach;
                          });
                      });
                  } else {
                      const campaignData = day.campaigns[selectedCampaign];
                      if (campaignData) {
                          Object.entries(campaignData).forEach(([province, reach]) => {
                              const group = getProvinceGroup(province);
                              result[group] += reach;
                          });
                      }
                  }
              } else {
                  Object.keys(day).forEach(key => {
                      if (key !== 'date' && key !== 'displayDate') {
                          const group = getProvinceGroup(key);
                          result[group] = (result[group] || 0) + (day[key] || 0);
                      }
                  });
              }
              return result;
          });
  }, [dailyProvinceReachData, filters.startDate, filters.endDate, selectedCampaign]);

  const uniqueCampaigns = useMemo(() => {
      const campaigns = new Set();
      dailyCampaignData.forEach(day => {
          Object.keys(day).forEach(key => {
              if (key !== 'date' && key !== 'displayDate') campaigns.add(key);
          });
      });
      return Array.from(campaigns);
  }, [dailyCampaignData]);

  const uniqueProvinceGroups = useMemo(() => {
      return ['Tucumán', 'Resto del NOA', 'Córdoba', 'Mendoza', 'Resto del País'];
  }, []);

  const resetDates = () => {
    setFilters(prev => ({ ...prev, startDate: '', endDate: '' }));
  };

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
    const cplGlobal = funnelLeads > 0 ? (totalInversion / funnelLeads).toFixed(0) : 0;

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
      totalInversion,
      cplGlobal
    };
  }, [filteredData, filteredEvents]);

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

  // Datos para gráfico unificado de Vendedores
  const leadsPerAgentByChannel = useMemo(() => {
    const agentChannelStats = {};
    filteredData.forEach(row => {
      const agent = row.AGENTE || 'Sin Agente';
      const channel = row.platform || 'Otro';
      if (!agentChannelStats[agent]) agentChannelStats[agent] = { name: agent, WhatsApp: 0, Instagram: 0, Facebook: 0, Otro: 0 };
      if (['WhatsApp', 'Instagram', 'Facebook', 'Otro'].includes(channel)) agentChannelStats[agent][channel]++;
    });
    return Object.values(agentChannelStats);
  }, [filteredData]);

  const leadsPerAgentByProvince = useMemo(() => {
    const agentProvinceStats = {};
    filteredData.forEach(row => {
      const agent = row.AGENTE || 'Sin Agente';
      const province = row['Provincia Detectada'] || 'Sin Datos';
      const provinceGroup = getProvinceGroup(province);
      if (!agentProvinceStats[agent]) agentProvinceStats[agent] = { name: agent, 'Tucumán': 0, 'Resto del NOA': 0, 'Córdoba': 0, 'Mendoza': 0, 'Resto del País': 0 };
      agentProvinceStats[agent][provinceGroup]++;
    });
    return Object.values(agentProvinceStats);
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
    filteredData.forEach(row => {
      if (row.fechaISO) {
        const dateKey = row.fechaISO;
        const displayDate = formatDateDisplay(dateKey);
        
        // Inicializar si no existe
        if (!dataByDay[dateKey]) {
            dataByDay[dateKey] = { 
                date: dateKey, 
                name: displayDate, 
                Tucuman: 0, 
                RestoNOA: 0, 
                RestoPais: 0,
                // Agregamos contadores para el Tooltip
                Pauta: 0, 
                Organico: 0 
            };
        }
        
        // Clasificación Regional
        const prov = (row['Provincia Detectada'] || '').toLowerCase();
        const noaProvs = ['salta', 'jujuy', 'santiago', 'catamarca', 'rioja'];
        if (prov.includes('tucum')) dataByDay[dateKey].Tucuman++;
        else if (noaProvs.some(p => prov.includes(p))) dataByDay[dateKey].RestoNOA++;
        else dataByDay[dateKey].RestoPais++;

        // Clasificación Orgánico vs Pauta para Tooltip
        const platform = (row.platform || '').toLowerCase();
        if (platform.includes('facebook') || platform.includes('instagram')) {
            dataByDay[dateKey].Pauta++;
        } else {
            // Asumimos WhatsApp y Otros como orgánico/directo en este contexto
            dataByDay[dateKey].Organico++;
        }
      }
    });

    filteredEvents.forEach(ev => {
        if (ev.dateISO && !dataByDay[ev.dateISO]) {
            dataByDay[ev.dateISO] = { date: ev.dateISO, name: formatDateDisplay(ev.dateISO), Tucuman: 0, RestoNOA: 0, RestoPais: 0, Pauta: 0, Organico: 0 };
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
        if (['Instagram', 'Facebook', 'WhatsApp', 'Otro'].includes(platform)) monthPlatform[month][platform]++;
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

  const toggleCollapse = (chartId) => setCollapsedCharts(prev => ({ ...prev, [chartId]: !prev[chartId] }));
  const toggleKPICollapse = (kpiId) => setCollapsedKPIs(prev => ({ ...prev, [kpiId]: !prev[kpiId] }));
  const toggleExpand = (chartId) => setExpandedChart(expandedChart === chartId ? null : chartId);

  // --- TOOLTIPS PERSONALIZADOS ---

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

  // Tooltip ESPECIAL para Evolución Diaria con datos de Pauta/Orgánico
  const DailyRegionTooltip = ({ active, payload, label }) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload;
      const totalDay = (data.Tucuman || 0) + (data.RestoNOA || 0) + (data.RestoPais || 0);
      
      return (
        <div className="bg-white p-3 border border-gray-200 shadow-md rounded text-sm z-50">
          <p className="font-bold mb-2">{label}</p>
          {/* Desglose por Región (Visual) */}
          {payload.map((entry, index) => (
            <p key={index} style={{ color: entry.fill }}>
                {entry.name}: {entry.value}
            </p>
          ))}
          
          <div className="border-t my-2 pt-1"></div>
          
          {/* Desglose Pauta vs Orgánico (Informativo) */}
          <p className="text-xs text-gray-600">
             <span className="font-semibold text-blue-600">Social/Pauta:</span> {data.Pauta || 0}
          </p>
          <p className="text-xs text-gray-600">
             <span className="font-semibold text-green-600">Orgánico/Directo:</span> {data.Organico || 0}
          </p>

          <div className="border-t mt-2 pt-1 font-bold text-gray-800">Total: {totalDay}</div>
        </div>
      );
    }
    return null;
  };

  const ProvinceReachTooltip = ({ active, payload, label }) => {
    if (active && payload && payload.length) {
      const totalReach = payload.reduce((sum, entry) => sum + (typeof entry.value === 'number' ? entry.value : 0), 0);
      const validPayload = payload.filter(entry => entry.value > 0);
      return (
        <div className="bg-white p-3 border border-gray-200 shadow-md rounded text-sm z-50">
          <p className="font-bold mb-2">{label}</p>
          {validPayload.map((entry, index) => {
            const percentage = totalReach > 0 ? ((entry.value / totalReach) * 100).toFixed(1) : 0;
            return (
              <p key={index} style={{ color: entry.fill }}>
                {entry.dataKey}: {entry.value.toLocaleString()} visitas ({percentage}%)
              </p>
            );
          })}
          <div className="border-t mt-2 pt-1 font-semibold text-gray-600">Total: {totalReach.toLocaleString()} visitas</div>
        </div>
      );
    }
    return null;
  };

  const CampaignInvestmentTooltip = ({ active, payload, label }) => {
    if (active && payload && payload.length) {
      const totalInvestment = payload.reduce((sum, entry) => sum + (typeof entry.value === 'number' ? entry.value : 0), 0);
      const validPayload = payload.filter(entry => entry.value > 0);
      return (
        <div className="bg-white p-3 border border-gray-200 shadow-md rounded text-sm z-50 max-w-sm">
          <p className="font-bold mb-2">{label}</p>
          <div className="max-h-64 overflow-y-auto">
            {validPayload.map((entry, index) => {
              const percentage = totalInvestment > 0 ? ((entry.value / totalInvestment) * 100).toFixed(1) : 0;
              return (
                <p key={index} style={{ color: entry.fill }} className="text-xs truncate">
                  {entry.dataKey}: ${ Math.round(entry.value).toLocaleString()} ({percentage}%)
                </p>
              );
            })}
          </div>
          <div className="border-t mt-2 pt-1 font-semibold text-gray-600">Total: ${Math.round(totalInvestment).toLocaleString()}</div>
        </div>
      );
    }
    return null;
  };

  const CampaignReachTooltip = ({ active, payload, label }) => {
    if (active && payload && payload.length) {
      const totalReach = payload.reduce((sum, entry) => sum + (typeof entry.value === 'number' ? entry.value : 0), 0);
      const validPayload = payload.filter(entry => entry.value > 0);
      return (
        <div className="bg-white p-3 border border-gray-200 shadow-md rounded text-sm z-50 max-w-sm">
          <p className="font-bold mb-2">{label}</p>
          <div className="max-h-64 overflow-y-auto">
            {validPayload.map((entry, index) => {
              const percentage = totalReach > 0 ? ((entry.value / totalReach) * 100).toFixed(1) : 0;
              return (
                <p key={index} style={{ color: entry.fill }} className="text-xs truncate">
                  {entry.dataKey}: {entry.value.toLocaleString()} visitas ({percentage}%)
                </p>
              );
            })}
          </div>
          <div className="border-t mt-2 pt-1 font-semibold text-gray-600">Total: {totalReach.toLocaleString()} visitas</div>
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
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 p-4 md:p-8">
      <div className="max-w-7xl mx-auto">
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

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-6">
          <KPICard id="kpi-leads" icon={Users} value={kpis.funnel.leads} label="Total Leads" gradient="from-blue-500 to-blue-600" />
          <KPICard id="kpi-cotizaciones" icon={Target} value={kpis.cotizacionesActivas} label="Cotizaciones Activas" gradient="from-green-500 to-green-600" />
          <KPICard id="kpi-visitas" icon={Eye} value={kpis.totalVisitas} label="Total Visitas" gradient="from-teal-500 to-teal-600" />
          <KPICard id="kpi-conv1" icon={TrendingUp} value={`${kpis.convLeadToCotiz}%`} label="Lead → Cotización" gradient="from-purple-500 to-purple-600" />
        </div>
        
        {kpis.totalInversion > 0 && (
             <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
                 <KPICard id="kpi-inv" icon={DollarSign} value={`$${kpis.totalInversion.toLocaleString()}`} label="Inversión Total Registrada" gradient="from-slate-700 to-slate-800" />
                 <KPICard id="kpi-cpl" icon={Target} value={`$${kpis.cplGlobal}`} label="Costo por Lead (CPL)" gradient="from-emerald-600 to-emerald-700" subtext="Inversión / Leads Totales" />
             </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
          <KPICard id="ratio-visitas-lead" icon={Eye} value={`${kpis.ratioVisitasLead}%`} label="Ratio Visitas / Leads" subtext={`${kpis.totalVisitas} visitas sobre ${kpis.funnel.leads} leads`} gradient="from-indigo-500 to-indigo-600" />
          <KPICard id="ratio-tuc-showroom" icon={MapPin} value={`${kpis.ratioTucShowroom}%`} label="Ratio Tucumán / Showroom" subtext={`${kpis.visitasShowroom} visitas sobre ${kpis.leadsTucuman} leads Tuc.`} gradient="from-orange-500 to-orange-600" />
          <KPICard id="rel-visita-cotiz" icon={Award} value={`${kpis.porcentajeVisitasConCotiz}%`} label="Visitas con Cotización" subtext={`${kpis.visitantesConCotizacion} de ${kpis.totalVisitas} ya cotizaron`} gradient="from-pink-500 to-pink-600" />
        </div>

        <div className="mb-8">
          <h2 className="text-2xl font-bold text-gray-800 mb-4 flex items-center gap-2">
            <Users className="w-6 h-6" />
            Análisis Comercial
          </h2>
          
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <ChartContainer id="funnel" title="Embudo de Ventas" height={300}>
              <BarChart data={funnelData}><CartesianGrid strokeDasharray="3 3" /><XAxis dataKey="name" /><YAxis /><Tooltip content={<CustomTooltip total={kpis.funnel.leads} />} /><Bar dataKey="value" radius={[8, 8, 0, 0]}>{funnelData.map((entry, index) => <Cell key={`cell-${index}`} fill={entry.fill} />)}</Bar></BarChart>
            </ChartContainer>

            <ChartContainer id="agent-performance" title="Rendimiento por Vendedor" height={300}>
              <BarChart data={agentPerformance}><CartesianGrid strokeDasharray="3 3" /><XAxis dataKey="name" /><YAxis /><Tooltip content={<CustomTooltip totalMap={{'Leads': kpis.funnel.leads, 'Cotizaciones': kpis.funnel.cotizaciones, 'OfertasComerciales': kpis.funnel.ofertas, 'Ventas': kpis.funnel.ventas}} />} /><Legend /><Bar dataKey="Leads" fill="#3b82f6" radius={[8, 8, 0, 0]} /><Bar dataKey="Cotizaciones" fill="#10b981" radius={[8, 8, 0, 0]} /><Bar dataKey="OfertasComerciales" fill="#f59e0b" radius={[8, 8, 0, 0]} /><Bar dataKey="Ventas" fill="#ef4444" radius={[8, 8, 0, 0]} /></BarChart>
            </ChartContainer>

            {/* GRÁFICO UNIFICADO: Desempeño de Vendedores (Por Canal / Por Región) */}
            <ChartContainer 
                id="agent-performance-unified" 
                title="Desempeño de Vendedores" 
                height={350}
                customContent={
                    <div className="mb-4 flex justify-end">
                        <div className="flex items-center gap-2 bg-gray-100 p-1 rounded-lg">
                            <button 
                                onClick={() => setAgentViewMode('channel')}
                                className={`px-3 py-1 rounded-md text-sm font-medium transition ${agentViewMode === 'channel' ? 'bg-white shadow text-blue-600' : 'text-gray-500 hover:text-gray-700'}`}
                            >
                                Por Canal
                            </button>
                            <button 
                                onClick={() => setAgentViewMode('region')}
                                className={`px-3 py-1 rounded-md text-sm font-medium transition ${agentViewMode === 'region' ? 'bg-white shadow text-blue-600' : 'text-gray-500 hover:text-gray-700'}`}
                            >
                                Por Región
                            </button>
                        </div>
                    </div>
                }
            >
              <BarChart data={agentViewMode === 'channel' ? leadsPerAgentByChannel : leadsPerAgentByProvince}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name" />
                <YAxis />
                <Tooltip content={<StackedTooltip />} />
                <Legend />
                
                {agentViewMode === 'channel' ? (
                    <>
                        <Bar dataKey="WhatsApp" stackId="a" fill="#25d366" name="WhatsApp" />
                        <Bar dataKey="Instagram" stackId="a" fill="#e4405f" name="Instagram" />
                        <Bar dataKey="Facebook" stackId="a" fill="#1877f2" name="Facebook" />
                        <Bar dataKey="Otro" stackId="a" fill="#9ca3af" name="Otro" />
                    </>
                ) : (
                    <>
                        <Bar dataKey="Tucumán" stackId="a" fill={GROUPED_PROVINCE_COLORS['Tucumán']} name="Tucumán" />
                        <Bar dataKey="Resto del NOA" stackId="a" fill={GROUPED_PROVINCE_COLORS['Resto del NOA']} name="Resto del NOA" />
                        <Bar dataKey="Córdoba" stackId="a" fill={GROUPED_PROVINCE_COLORS['Córdoba']} name="Córdoba" />
                        <Bar dataKey="Mendoza" stackId="a" fill={GROUPED_PROVINCE_COLORS['Mendoza']} name="Mendoza" />
                        <Bar dataKey="Resto del País" stackId="a" fill={GROUPED_PROVINCE_COLORS['Resto del País']} name="Resto del País" />
                    </>
                )}
              </BarChart>
            </ChartContainer>

            <ChartContainer id="daily-region" title="Evolución Diaria + Eventos Marketing" height={500}>
              <BarChart data={dailyRegionData} margin={{ bottom: 120 }}> 
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis 
                  dataKey="date" 
                  tickFormatter={formatDateDisplay} 
                  interval="preserveStartEnd"
                />
                <YAxis />
                {/* TOOLTIP INTELIGENTE CON DESGLOSE ORGÁNICO/PAUTA */}
                <Tooltip content={<DailyRegionTooltip />} />
                <Legend wrapperStyle={{ top: 0 }} />
                
                <Bar dataKey="Tucuman" stackId="a" fill="#f59e0b" name="Tucumán" />
                <Bar dataKey="RestoNOA" stackId="a" fill="#3b82f6" name="Resto NOA" />
                <Bar dataKey="RestoPais" stackId="a" fill="#10b981" name="Resto País" />

                {filteredEvents.map((event, idx) => {
                    const lane = idx % 6; 
                    const verticalOffset = 60 + (lane * 25); 
                    const eventColor = getCampaignColor(event.name);
                    return (
                      <ReferenceLine 
                          key={idx} 
                          x={event.dateISO} 
                          stroke={eventColor}
                          strokeDasharray="3 3"
                          strokeWidth={3}
                          label={{ 
                              position: 'insideBottom',
                              value: event.name, 
                              fill: eventColor,
                              fontSize: 11,
                              fontWeight: 'bold',
                              angle: 0, 
                              dy: verticalOffset,
                          }} 
                      />
                    );
                })}
              </BarChart>
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

        {(filteredDailyCampaigns.length > 0 || filteredDailyReach.length > 0 || filteredDailyProvinceReach.length > 0) && (
          <div className="mb-8">
            <h2 className="text-2xl font-bold text-gray-800 mb-4 flex items-center gap-2">
              <Megaphone className="w-6 h-6" />
              Análisis de Publicidad
            </h2>
            
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {filteredDailyCampaigns.length > 0 && (
                <div className="lg:col-span-2">
                  <ChartContainer id="campaign-investment" title="Inversión Diaria por Publicación (ARS)" height={400}>
                    <BarChart data={filteredDailyCampaigns} margin={{ bottom: 80 }}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis 
                        dataKey="displayDate" 
                        angle={-45}
                        textAnchor="end"
                        height={80}
                        interval="preserveStartEnd"
                      />
                      <YAxis />
                      <Tooltip content={<CampaignInvestmentTooltip />} />
                      <Legend 
                        wrapperStyle={{ 
                          paddingTop: '20px',
                          maxHeight: '120px',
                          overflowY: 'auto'
                        }}
                        iconSize={10}
                      />
                      {uniqueCampaigns.map((campaign) => (
                        <Bar 
                          key={campaign}
                          dataKey={campaign}
                          stackId="campaigns"
                          fill={getCampaignColor(campaign)}
                          name={campaign.length > 30 ? campaign.substring(0, 27) + '...' : campaign}
                        />
                      ))}
                    </BarChart>
                  </ChartContainer>
                </div>
              )}

              {filteredDailyReach.length > 0 && (
                <div className="lg:col-span-2">
                  <ChartContainer id="campaign-reach" title="Alcance Diario de Publicaciones (Visitas Únicas)" height={400}>
                    <BarChart data={filteredDailyReach} margin={{ bottom: 80 }}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis 
                        dataKey="displayDate" 
                        angle={-45}
                        textAnchor="end"
                        height={80}
                        interval="preserveStartEnd"
                      />
                      <YAxis />
                      <Tooltip content={<CampaignReachTooltip />} />
                      <Legend 
                        wrapperStyle={{ 
                          paddingTop: '20px',
                          maxHeight: '120px',
                          overflowY: 'auto'
                        }}
                        iconSize={10}
                      />
                      {uniqueCampaigns.map((campaign) => (
                        <Bar 
                          key={campaign}
                          dataKey={campaign}
                          stackId="reach"
                          fill={getCampaignColor(campaign)}
                          name={campaign.length > 30 ? campaign.substring(0, 27) + '...' : campaign}
                        />
                      ))}
                    </BarChart>
                  </ChartContainer>
                </div>
              )}

              {filteredDailyProvinceReach.length > 0 && (
                <div className="lg:col-span-2">
                  <ChartContainer 
                    id="province-reach" 
                    title="Alcance Diario por Región (Visitas Únicas)" 
                    height={400}
                    customContent={
                      <div className="mb-4">
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          Filtrar por Publicación
                        </label>
                        <select 
                          value={selectedCampaign} 
                          onChange={(e) => setSelectedCampaign(e.target.value)}
                          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 bg-white"
                        >
                          <option value="Todas">Todas las publicaciones</option>
                          {uniqueCampaigns.map(campaign => (
                            <option key={campaign} value={campaign}>{campaign}</option>
                          ))}
                        </select>
                      </div>
                    }
                  >
                    <BarChart data={filteredDailyProvinceReach} margin={{ bottom: 80 }}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis 
                        dataKey="displayDate" 
                        angle={-45}
                        textAnchor="end"
                        height={80}
                        interval="preserveStartEnd"
                      />
                      <YAxis />
                      <Tooltip content={<ProvinceReachTooltip />} />
                      <Legend 
                        wrapperStyle={{ 
                          paddingTop: '20px',
                          maxHeight: '120px',
                          overflowY: 'auto'
                        }}
                        iconSize={10}
                      />
                      {uniqueProvinceGroups.map((group) => (
                        <Bar 
                          key={group}
                          dataKey={group}
                          stackId="provinces"
                          fill={GROUPED_PROVINCE_COLORS[group]}
                          name={group}
                        />
                      ))}
                    </BarChart>
                  </ChartContainer>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default App;