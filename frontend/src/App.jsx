import React, { useState, useEffect, useCallback } from 'react';
import {
  Activity,
  Database,
  Search,
  RefreshCw,
  CheckCircle2,
  AlertCircle,
  Calendar,
  ChevronLeft,
  ChevronRight,
  Copy,
  Check,
  FileText,
  Layers,
  Server,
  X,
  Clock,
  Sparkles,
  Info,
  Briefcase,
  Stethoscope,
  Pill,
  Package,
  Zap,
  Github,
  Linkedin,
  ExternalLink
} from 'lucide-react';

import { Button } from './components/ui/button';
import { Input } from './components/ui/input';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from './components/ui/card';
import { Badge } from './components/ui/badge';
import {
  Table,
  TableHeader,
  TableBody,
  TableHead,
  TableRow,
  TableCell
} from './components/ui/table';

export default function App() {
  const [backendStatus, setBackendStatus] = useState(null);
  const [stats, setStats] = useState({ totalProcedures: 0, sources: [] });
  const [procedures, setProcedures] = useState([]);
  const [pagination, setPagination] = useState({ page: 1, limit: 15, total: 0, totalPages: 1 });
  const [search, setSearch] = useState('');
  const [searchMeta, setSearchMeta] = useState(null);
  const [selectedSource, setSelectedSource] = useState('all');
  const [loading, setLoading] = useState(true);
  const [notification, setNotification] = useState(null);
  const [copiedId, setCopiedId] = useState(null);
  const [selectedItem, setSelectedItem] = useState(null);

  const showNotification = (msg, type = 'success') => {
    setNotification({ msg, type });
    setTimeout(() => setNotification(null), 5000);
  };

  const copyToClipboard = (text, id) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    showNotification(`Código ${text} copiado para a área de transferência!`, 'success');
    setTimeout(() => setCopiedId(null), 2000);
  };

  // Busca de procedimentos com suporte a tokenização, FTS e ranking
  const fetchProcedures = useCallback(async (
    page = 1,
    searchQuery = search,
    sourceFilter = selectedSource,
    limit = pagination.limit
  ) => {
    setLoading(true);
    try {
      const queryParams = new URLSearchParams({
        page: String(page),
        limit: String(limit),
        q: searchQuery,
        source: sourceFilter
      });

      const res = await fetch(`/api/tuss?${queryParams}`);
      if (!res.ok) {
        throw new Error(`Erro ${res.status}: Não foi possível obter os dados da API.`);
      }

      const data = await res.json();
      if (data.data) {
        setProcedures(data.data);
        setPagination(data.pagination);
        setSearchMeta(data.searchMeta || null);
      }
    } catch (err) {
      console.error('Erro na requisição:', err);
      showNotification(err.message, 'error');
    } finally {
      setLoading(false);
    }
  }, [search, selectedSource, pagination.limit]);

  // Checagem de status e estatísticas da API
  const checkStatusAndStats = async () => {
    try {
      const [resStatus, resStats] = await Promise.all([
        fetch('/api'),
        fetch('/api/stats')
      ]);

      if (resStatus.ok) {
        const info = await resStatus.json();
        setBackendStatus(info);
      }

      if (resStats.ok) {
        const statsData = await resStats.json();
        setStats(statsData);
      }
    } catch (err) {
      setBackendStatus({ error: 'Erro de conexão' });
    }
  };

  useEffect(() => {
    checkStatusAndStats();
    fetchProcedures(1, '', 'all');
  }, []);

  // Fecha o modal ao pressionar a tecla Escape
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape' && selectedItem) {
        setSelectedItem(null);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedItem]);

  // Executa busca apenas no submit (Enter ou clique no botão Buscar)
  const handleSearchSubmit = (e) => {
    if (e) e.preventDefault();
    fetchProcedures(1, search, selectedSource);
  };

  const handleSourceChange = (source) => {
    setSelectedSource(source);
    fetchProcedures(1, search, source);
  };

  const handleQuickFilter = (term) => {
    setSearch(term);
    fetchProcedures(1, term, selectedSource);
  };

  const getSourceCount = (src) => {
    return stats.sources?.find((s) => s.source === src)?.count || 0;
  };

  const getQuickFilters = () => {
    if (selectedSource === 'tuss-19') {
      return [
        { label: 'Fresas', query: 'fresa' },
        { label: 'Próteses', query: 'protese' },
        { label: 'Implantes', query: 'implante' },
        { label: 'Cateteres', query: 'cateter' },
        { label: 'Sondas', query: 'sonda' },
        { label: 'Fios Guia', query: 'fio guia' },
      ];
    }
    if (selectedSource === 'tuss-24') {
      return [
        { label: 'Médico', query: 'medico' },
        { label: 'Cirurgião', query: 'cirurgiao' },
        { label: 'Dentista', query: 'dentista' },
        { label: 'Enfermeiro', query: 'enfermeiro' },
        { label: 'Fisioterapeuta', query: 'fisioterapeuta' },
      ];
    }
    if (selectedSource === 'tuss-20') {
      return [
        { label: 'Dipirona', query: 'dipirona' },
        { label: 'Amoxicilina', query: 'amoxicilina' },
        { label: 'Insulina', query: 'insulina' },
        { label: 'Omeprazol', query: 'omeprazol' },
      ];
    }
    if (selectedSource === 'tuss-18') {
      return [
        { label: 'Diária', query: 'diaria' },
        { label: 'Taxa de Sala', query: 'taxa de sala' },
        { label: 'Oxigênio', query: 'oxigenio' },
        { label: 'UTI', query: 'uti' },
      ];
    }
    return [
      { label: 'Consultas', query: 'consulta' },
      { label: 'Exames', query: 'exame' },
      { label: 'Cirurgias', query: 'cirurgia' },
      { label: 'Odontologia', query: 'dente' },
      { label: 'Ressonância', query: 'ressonancia' },
      { label: 'Tomografia', query: 'tomografia' },
    ];
  };

  const categories = [
    {
      id: 'all',
      title: 'Todas as Tabelas',
      subtitle: 'Base Geral Unificada',
      count: stats.totalProcedures || pagination.total,
      icon: Layers
    },
    {
      id: 'tuss-18',
      title: 'TUSS-18 (Diárias/Taxas)',
      subtitle: 'Taxas Hospitalares',
      count: getSourceCount('tuss-18'),
      icon: FileText
    },
    {
      id: 'tuss-19',
      title: 'TUSS-19 (OPME)',
      subtitle: 'Materiais e Próteses',
      count: getSourceCount('tuss-19'),
      icon: Package
    },
    {
      id: 'tuss-20',
      title: 'TUSS-20 (Medicamentos)',
      subtitle: 'Medicamentos e Fármacos',
      count: getSourceCount('tuss-20'),
      icon: Pill
    },
    {
      id: 'tuss-22',
      title: 'TUSS-22 (Procedimentos)',
      subtitle: 'Eventos e Consultas',
      count: getSourceCount('tuss-22'),
      icon: Stethoscope
    },
    {
      id: 'tuss-24',
      title: 'TUSS-24 (CBO)',
      subtitle: 'Ocupações Médicas',
      count: getSourceCount('tuss-24'),
      icon: Briefcase
    }
  ];

  return (
    <div className="min-h-screen bg-slate-50/60 text-slate-900 pb-16">
      {/* Top Navbar */}
      <header className="sticky top-0 z-40 w-full border-b bg-white/95 backdrop-blur supports-[backdrop-filter]:bg-white/60 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="h-10 w-10 rounded-lg bg-primary/10 text-primary flex items-center justify-center font-bold">
              <Layers className="h-6 w-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-lg font-bold tracking-tight text-slate-900">Sistema TUSS</h1>
                <Badge variant="success" className="text-[10px] px-1.5 py-0 gap-1">
                  <Zap className="h-3 w-3" /> FTS Indexado
                </Badge>
              </div>
              <p className="text-xs text-muted-foreground hidden sm:block">
                Terminologia Unificada da Saúde Suplementar • PostgreSQL + Express + React + Docker
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2.5">
            <a
              href="https://www.linkedin.com/in/jadsoncerqueira"
              target="_blank"
              rel="noopener noreferrer"
              className="hidden sm:inline-flex items-center gap-1.5 text-xs font-medium text-blue-700 bg-blue-50 hover:bg-blue-100/80 border border-blue-200/60 px-3 py-1.5 rounded-full transition-colors"
              title="LinkedIn do Engenheiro de Software (Jadson Cerqueira)"
            >
              <Linkedin className="h-3.5 w-3.5" />
              <span>Jadson Cerqueira</span>
            </a>

            <a
              href="https://github.com/jadsoncerqueira/sistema-tuss"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-700 bg-slate-100 hover:bg-slate-200/80 border border-slate-200/60 px-3 py-1.5 rounded-full transition-colors"
              title="Código-fonte no GitHub"
            >
              <Github className="h-3.5 w-3.5 text-slate-800" />
              <span className="hidden md:inline">GitHub</span>
            </a>

            <div className="flex items-center gap-2 bg-slate-100 px-3 py-1.5 rounded-full text-xs font-medium text-slate-700">
              <span className={`inline-block h-2 w-2 rounded-full ${backendStatus?.message ? 'bg-emerald-500 animate-pulse' : 'bg-rose-500'}`} />
              {backendStatus?.message ? 'API Online' : 'API Offline'}
            </div>
          </div>
        </div>
      </header>

      {/* Main Container */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-8 space-y-6">
        {/* Toast Notificação */}
        {notification && (
          <div className={`p-4 rounded-lg flex items-center justify-between shadow-sm border transition-all animate-in fade-in slide-in-from-top-2 ${
            notification.type === 'success'
              ? 'bg-emerald-50 border-emerald-200 text-emerald-900'
              : 'bg-rose-50 border-rose-200 text-rose-900'
          }`}>
            <div className="flex items-center gap-3">
              {notification.type === 'success' ? (
                <CheckCircle2 className="h-5 w-5 text-emerald-600 flex-shrink-0" />
              ) : (
                <AlertCircle className="h-5 w-5 text-rose-600 flex-shrink-0" />
              )}
              <p className="text-sm font-medium">{notification.msg}</p>
            </div>
            <button
              onClick={() => setNotification(null)}
              className="text-slate-400 hover:text-slate-600"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        )}

        {/* Interactive Filter Cards (Cards no topo que funcionam como os seletores de tabela) */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3.5">
          {categories.map((cat) => {
            const Icon = cat.icon;
            const isSelected = selectedSource === cat.id;

            return (
              <button
                key={cat.id}
                type="button"
                onClick={() => handleSourceChange(cat.id)}
                className={`relative text-left rounded-xl p-4 transition-all duration-200 border flex flex-col justify-between group focus:outline-none focus-visible:ring-2 focus-visible:ring-primary ${
                  isSelected
                    ? 'bg-slate-900 border-slate-900 text-white shadow-md ring-2 ring-slate-900/10 scale-[1.02]'
                    : 'bg-white border-slate-200/90 text-slate-800 hover:border-slate-300 hover:bg-slate-50/80 hover:shadow-sm'
                }`}
              >
                <div className="flex items-center justify-between w-full mb-3">
                  <div className={`h-8 w-8 rounded-lg flex items-center justify-center transition-colors ${
                    isSelected
                      ? 'bg-white/10 text-white'
                      : 'bg-slate-100 text-slate-700 group-hover:bg-slate-200/70'
                  }`}>
                    <Icon className="h-4 w-4" />
                  </div>

                  {isSelected ? (
                    <Badge variant="success" className="text-[10px] px-1.5 py-0 bg-emerald-500/20 text-emerald-300 border-emerald-500/30">
                      Ativo
                    </Badge>
                  ) : (
                    <span className="text-[10px] font-mono text-slate-400 opacity-0 group-hover:opacity-100 transition-opacity">
                      Filtrar ↵
                    </span>
                  )}
                </div>

                <div>
                  <span className={`text-[11px] font-semibold uppercase tracking-wider block truncate ${
                    isSelected ? 'text-slate-300' : 'text-slate-500'
                  }`}>
                    {cat.title}
                  </span>
                  <div className={`text-xl font-bold mt-0.5 tracking-tight ${
                    isSelected ? 'text-white' : 'text-slate-900'
                  }`}>
                    {cat.count?.toLocaleString() || '0'}
                  </div>
                  <p className={`text-[11px] mt-1 truncate ${
                    isSelected ? 'text-slate-400' : 'text-muted-foreground'
                  }`}>
                    {cat.subtitle}
                  </p>
                </div>
              </button>
            );
          })}
        </div>

        {/* Search & Filter Card */}
        <Card className="border-slate-200/80 shadow-sm">
          <CardContent className="p-5">
            <form onSubmit={handleSearchSubmit} className="flex flex-col sm:flex-row gap-3">
              <div className="relative flex-1">
                <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  type="text"
                  placeholder={
                    selectedSource === 'tuss-19'
                      ? "Digite código (ex: 79993990), descrição, modelo ou fabricante e aperte Enter..."
                      : selectedSource === 'tuss-24'
                      ? "Digite CBO (ex: 225125) ou ocupação (ex: médico, cirurgião) e aperte Enter..."
                      : selectedSource === 'tuss-20'
                      ? "Digite código ou medicamento (ex: dipirona, amoxicilina) e aperte Enter..."
                      : selectedSource === 'tuss-18'
                      ? "Digite código ou taxa/diária (ex: diária, oxigênio, UTI) e aperte Enter..."
                      : "Digite palavras-chave ou código e aperte Enter (ou clique em Buscar)..."
                  }
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="pl-10 h-11 bg-white border-slate-300 focus-visible:ring-primary text-sm shadow-none"
                />
                {search && (
                  <button
                    type="button"
                    onClick={() => {
                      setSearch('');
                      fetchProcedures(1, '', selectedSource);
                    }}
                    className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-1"
                    title="Limpar campo"
                  >
                    <X className="h-4 w-4" />
                  </button>
                )}
              </div>
              <Button type="submit" size="lg" disabled={loading} className="gap-2 h-11 px-6 font-medium">
                <Search className="h-4 w-4" />
                <span>Buscar</span>
              </Button>
            </form>

            {/* Quick Filters */}
            <div className="mt-3.5 flex items-center gap-2 flex-wrap text-xs text-muted-foreground">
              <span className="font-medium text-slate-500">Sugestões rápidas:</span>
              {getQuickFilters().map((filter) => (
                <button
                  key={filter.query}
                  onClick={() => handleQuickFilter(filter.query)}
                  className={`px-2.5 py-1 rounded-md transition-colors border ${
                    search === filter.query
                      ? 'bg-primary text-white border-primary font-medium'
                      : 'bg-slate-100 hover:bg-slate-200/80 text-slate-700 border-slate-200'
                  }`}
                >
                  {filter.label}
                </button>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Procedures Table Card */}
        <Card className="border-slate-200/80 shadow-sm overflow-hidden">
          <CardHeader className="bg-white border-b px-6 py-4 flex flex-row items-center justify-between">
            <div>
              <div className="flex items-center gap-2">
                <CardTitle className="text-base font-semibold text-slate-900">
                  Resultados da Busca
                </CardTitle>
                {selectedSource !== 'all' && (
                  <Badge variant="outline" className="text-xs uppercase">
                    {selectedSource}
                  </Badge>
                )}
                {searchMeta && search && (
                  <Badge variant="info" className="text-[11px] gap-1 font-mono">
                    <Zap className="h-3 w-3 text-blue-600" />
                    {searchMeta.executionTimeMs}ms
                  </Badge>
                )}
              </div>
              <CardDescription className="text-xs mt-0.5">
                Exibindo página {pagination.page} de {pagination.totalPages} ({pagination.total.toLocaleString()} encontrados)
                {search && searchMeta?.tokenQuery && (
                  <span className="hidden md:inline ml-2 text-slate-400">
                    • Tokens: <code className="text-[10px] text-slate-600">{searchMeta.tokenQuery}</code>
                  </span>
                )}
              </CardDescription>
            </div>

            <div className="flex items-center gap-2">
              <span className="text-xs text-muted-foreground hidden sm:inline">Por página:</span>
              <select
                value={pagination.limit}
                onChange={(e) => {
                  const newLimit = Number(e.target.value);
                  setPagination((prev) => ({ ...prev, limit: newLimit }));
                  fetchProcedures(1, search, selectedSource, newLimit);
                }}
                className="h-8 rounded-md border border-input bg-white px-2 py-1 text-xs shadow-sm focus:outline-none focus:ring-1 focus:ring-primary"
              >
                <option value={10}>10</option>
                <option value={15}>15</option>
                <option value={25}>25</option>
                <option value={50}>50</option>
              </select>
            </div>
          </CardHeader>

          <CardContent className="p-0">
            {loading ? (
              <div className="py-20 flex flex-col items-center justify-center gap-3 text-muted-foreground">
                <RefreshCw className="h-8 w-8 animate-spin text-primary" />
                <p className="text-sm font-medium">Buscando na base de dados...</p>
              </div>
            ) : procedures.length === 0 ? (
              <div className="py-20 text-center space-y-3">
                <div className="h-12 w-12 rounded-full bg-slate-100 text-slate-400 mx-auto flex items-center justify-center">
                  <Search className="h-6 w-6" />
                </div>
                <div>
                  <h4 className="text-sm font-semibold text-slate-900">Nenhum resultado encontrado</h4>
                  <p className="text-xs text-muted-foreground mt-1">
                    Não encontramos registros para "{search}". Tente buscar por outros termos ou alterar o filtro de categoria nos cards acima.
                  </p>
                </div>
                {search && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setSearch('');
                      fetchProcedures(1, '', selectedSource);
                    }}
                  >
                    Limpar pesquisa
                  </Button>
                )}
              </div>
            ) : (
              <Table>
                <TableHeader className="bg-slate-50/75">
                  <TableRow>
                    <TableHead className="w-[140px] font-semibold text-slate-700">Código</TableHead>
                    <TableHead className="w-[120px] font-semibold text-slate-700">Tabela</TableHead>
                    <TableHead className="font-semibold text-slate-700">Descrição / Material / Ocupação</TableHead>
                    <TableHead className="w-[130px] font-semibold text-slate-700">Início Vigência</TableHead>
                    <TableHead className="w-[130px] font-semibold text-slate-700">Fim Vigência</TableHead>
                    <TableHead className="w-[90px] text-right font-semibold text-slate-700">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {procedures.map((item) => (
                    <TableRow key={item.id} className="hover:bg-slate-50/60 transition-colors">
                      <TableCell className="font-mono font-semibold text-xs text-slate-900">
                        <div className="flex items-center gap-1.5">
                          <span className="bg-slate-100 text-slate-800 px-2 py-1 rounded border border-slate-200">
                            {item.codigo_tuss}
                          </span>
                          <button
                            onClick={() => copyToClipboard(item.codigo_tuss, item.id)}
                            className="text-slate-400 hover:text-primary transition-colors p-1 rounded hover:bg-slate-100"
                            title="Copiar Código"
                            aria-label={`Copiar código TUSS ${item.codigo_tuss}`}
                          >
                            {copiedId === item.id ? (
                              <Check className="h-3.5 w-3.5 text-emerald-600" />
                            ) : (
                              <Copy className="h-3.5 w-3.5" />
                            )}
                          </button>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant={
                            item.source === 'tuss-19'
                              ? 'default'
                              : item.source === 'tuss-24'
                              ? 'success'
                              : item.source === 'tuss-22'
                              ? 'info'
                              : 'secondary'
                          }
                          className="text-[11px] font-medium"
                        >
                          {item.source || 'tuss'}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <span className="font-medium text-slate-800 text-sm leading-relaxed line-clamp-2">
                          {item.display_name}
                        </span>
                        {item.extras?.fabricante && (
                          <span className="text-[11px] text-muted-foreground block mt-0.5">
                            Fabricante: {item.extras.fabricante} {item.extras.modelo ? `• Modelo: ${item.extras.modelo}` : ''}
                          </span>
                        )}
                      </TableCell>
                      <TableCell className="text-xs text-slate-600 whitespace-nowrap">
                        <div className="flex items-center gap-1.5">
                          <Calendar className="h-3.5 w-3.5 text-slate-400" />
                          <span>{item.inicio_vigencia || '-'}</span>
                        </div>
                      </TableCell>
                      <TableCell className="text-xs text-slate-600 whitespace-nowrap">
                        {item.fim_vigencia && item.fim_vigencia !== '-' ? (
                          <Badge variant="destructive" className="text-[11px] font-normal">
                            {item.fim_vigencia}
                          </Badge>
                        ) : (
                          <Badge variant="success" className="text-[11px] font-normal">
                            Vigente
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setSelectedItem(item)}
                          className="h-8 text-xs text-primary hover:text-primary hover:bg-primary/10 gap-1"
                        >
                          <Info className="h-3.5 w-3.5" />
                          <span className="hidden sm:inline">Detalhes</span>
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>

          {/* Table Footer with Pagination */}
          {!loading && procedures.length > 0 && (
            <div className="border-t bg-slate-50/60 px-6 py-4 flex flex-col sm:flex-row items-center justify-between gap-3">
              <div className="text-xs text-muted-foreground">
                Mostrando <strong>{(pagination.page - 1) * pagination.limit + 1}</strong> a{' '}
                <strong>{Math.min(pagination.page * pagination.limit, pagination.total)}</strong> de{' '}
                <strong>{pagination.total.toLocaleString()}</strong> registros
              </div>

              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={pagination.page <= 1 || loading}
                  onClick={() => fetchProcedures(pagination.page - 1, search, selectedSource)}
                  className="gap-1 text-xs h-8 bg-white"
                >
                  <ChevronLeft className="h-4 w-4" />
                  <span>Anterior</span>
                </Button>

                <div className="text-xs font-medium px-3 text-slate-700">
                  {pagination.page} / {pagination.totalPages}
                </div>

                <Button
                  variant="outline"
                  size="sm"
                  disabled={pagination.page >= pagination.totalPages || loading}
                  onClick={() => fetchProcedures(pagination.page + 1, search, selectedSource)}
                  className="gap-1 text-xs h-8 bg-white"
                >
                  <span>Próxima</span>
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          )}
        </Card>
      </main>

      {/* Footer com identificação do Engenheiro de Software */}
      <footer className="mt-16 border-t border-slate-200/80 bg-white/70 backdrop-blur py-8">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex flex-col items-center sm:items-start text-center sm:text-left space-y-1">
            <p className="text-sm font-semibold text-slate-900 flex flex-wrap items-center justify-center sm:justify-start gap-2">
              <span>Desenvolvido por</span>
              <span className="text-primary font-bold">Jadson Cerqueira</span>
              <span className="text-[11px] bg-slate-100 text-slate-700 px-2 py-0.5 rounded-full border border-slate-200 font-medium">
                Engenheiro de Software
              </span>
            </p>
            <p className="text-xs text-muted-foreground">
              Projeto prático focado na otimização e busca de alta performance sobre grandes volumes de dados.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <a
              href="https://www.linkedin.com/in/jadsoncerqueira"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 text-xs font-medium text-blue-700 bg-blue-50 hover:bg-blue-100 border border-blue-200 px-3 py-2 rounded-lg transition-colors"
              title="Acessar perfil no LinkedIn"
            >
              <Linkedin className="h-4 w-4" />
              <span>LinkedIn</span>
              <ExternalLink className="h-3 w-3 text-blue-400" />
            </a>

            <a
              href="https://github.com/jadsoncerqueira/sistema-tuss"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-800 bg-slate-100 hover:bg-slate-200 border border-slate-200 px-3 py-2 rounded-lg transition-colors"
              title="Acessar repositório no GitHub"
            >
              <Github className="h-4 w-4" />
              <span>Repositório</span>
              <ExternalLink className="h-3 w-3 text-slate-400" />
            </a>
          </div>
        </div>
      </footer>

      {/* Modal de Detalhes (Shadcn Dialog Style) */}
      {selectedItem && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in">
          <div className="bg-white rounded-xl shadow-xl max-w-2xl w-full border border-slate-200 overflow-hidden animate-in zoom-in-95">
            <div className="px-6 py-5 border-b flex items-start justify-between bg-slate-50/50">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <Badge variant="info">Código {selectedItem.codigo_tuss}</Badge>
                  <Badge variant="outline">{selectedItem.source || 'tuss'}</Badge>
                  {selectedItem.relevance_score && (
                    <Badge variant="secondary" className="font-mono text-[10px]">
                      Score: {Number(selectedItem.relevance_score).toFixed(1)}
                    </Badge>
                  )}
                </div>
                <h3 className="text-lg font-bold text-slate-900 leading-snug pt-1">
                  {selectedItem.display_name}
                </h3>
              </div>
              <button
                onClick={() => setSelectedItem(null)}
                className="text-slate-400 hover:text-slate-600 rounded-md p-1 hover:bg-slate-100"
                aria-label="Fechar detalhes do procedimento"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="p-6 space-y-4 text-sm max-h-[70vh] overflow-y-auto">
              <div className="grid grid-cols-2 gap-4">
                <div className="bg-slate-50 p-3.5 rounded-lg border border-slate-200/80">
                  <span className="text-xs font-semibold text-slate-500 block uppercase tracking-wider">Início da Vigência</span>
                  <span className="font-medium text-slate-800 mt-1 block">{selectedItem.inicio_vigencia || 'Não informado'}</span>
                </div>
                <div className="bg-slate-50 p-3.5 rounded-lg border border-slate-200/80">
                  <span className="text-xs font-semibold text-slate-500 block uppercase tracking-wider">Fim da Vigência</span>
                  <span className="font-medium text-slate-800 mt-1 block">{selectedItem.fim_vigencia || 'Em vigor (Vigente)'}</span>
                </div>
              </div>

              {/* Informações específicas de Materiais / OPME */}
              {selectedItem.extras && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {selectedItem.extras.fabricante && (
                    <div className="bg-slate-50 p-3 rounded-lg border border-slate-200/80">
                      <span className="text-[11px] font-semibold text-slate-500 uppercase block">Fabricante</span>
                      <span className="font-medium text-slate-900 text-xs mt-0.5 block">{selectedItem.extras.fabricante}</span>
                    </div>
                  )}
                  {selectedItem.extras.modelo && (
                    <div className="bg-slate-50 p-3 rounded-lg border border-slate-200/80">
                      <span className="text-[11px] font-semibold text-slate-500 uppercase block">Modelo</span>
                      <span className="font-medium text-slate-900 text-xs mt-0.5 block">{selectedItem.extras.modelo}</span>
                    </div>
                  )}
                  {selectedItem.extras.registro_anvisa && (
                    <div className="bg-slate-50 p-3 rounded-lg border border-slate-200/80">
                      <span className="text-[11px] font-semibold text-slate-500 uppercase block">Registro ANVISA</span>
                      <span className="font-medium text-slate-900 text-xs mt-0.5 block">{selectedItem.extras.registro_anvisa}</span>
                    </div>
                  )}
                  {selectedItem.extras.classe_risco && (
                    <div className="bg-slate-50 p-3 rounded-lg border border-slate-200/80">
                      <span className="text-[11px] font-semibold text-slate-500 uppercase block">Classe de Risco</span>
                      <span className="font-medium text-slate-900 text-xs mt-0.5 block">{selectedItem.extras.classe_risco}</span>
                    </div>
                  )}
                </div>
              )}

              <div className="bg-slate-900 text-slate-100 p-4 rounded-lg font-mono text-xs overflow-x-auto space-y-1">
                <div className="text-slate-400 text-[10px] uppercase font-bold tracking-widest pb-1 border-b border-slate-800">
                  Estrutura JSON do Registro
                </div>
                <pre>{JSON.stringify(selectedItem, null, 2)}</pre>
              </div>
            </div>

            <div className="px-6 py-4 bg-slate-50 border-t flex justify-end gap-3">
              <Button
                variant="outline"
                size="sm"
                onClick={() => copyToClipboard(selectedItem.codigo_tuss, 'modal')}
              >
                <Copy className="h-4 w-4 mr-1.5" />
                Copiar Código
              </Button>
              <Button size="sm" onClick={() => setSelectedItem(null)}>
                Fechar
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
