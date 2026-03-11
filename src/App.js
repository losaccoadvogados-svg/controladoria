import React, { useState, useMemo, useEffect, useCallback } from "react";

const SHEET_ID = "19BQRAj5Hp2oqvxk2HjcdgPnT9rBxtgYFgBzACjAewcc";
const CSV_URL = `https://docs.google.com/spreadsheets/d/${SHEET_ID}/gviz/tq?tqx=out:csv`;

const TIPOS_ACAO = [
  "Divórcio Consensual", "Divórcio Litigioso", "Guarda", "Alimentos",
  "Regulamentação de Visitas", "Partilha de Bens", "União Estável",
  "Investigação de Paternidade", "Inventário", "Medida Protetiva", "Outro"
];

const FASES = [
  "Petição Inicial", "Citação", "Contestação", "Réplica",
  "Audiência de Conciliação", "Instrução e Julgamento", "Sentença",
  "Recurso", "Cumprimento de Sentença", "Arquivado"
];

function parseCSV(text) {
  const lines = text.split("\n").filter(l => l.trim());
  if (lines.length < 2) return [];
  const headers = lines[0].split(",").map(h => h.replace(/^"|"$/g, "").trim());
  return lines.slice(1).map((line, idx) => {
    const values = [];
    let current = "";
    let inQuotes = false;
    for (let i = 0; i < line.length; i++) {
      if (line[i] === '"') { inQuotes = !inQuotes; }
      else if (line[i] === ',' && !inQuotes) { values.push(current.trim()); current = ""; }
      else { current += line[i]; }
    }
    values.push(current.trim());
    const obj = {};
    headers.forEach((h, i) => { obj[h] = values[i] || ""; });
    obj._rowIndex = idx + 2;
    if (!obj.id) obj.id = String(idx + 1);
    return obj;
  }).filter(row => row.numero || row.cliente);
}

function diasDesde(dateStr) {
  if (!dateStr) return null;
  let d;
  if (dateStr.includes("/")) {
    const parts = dateStr.split("/");
    if (parts[2] && parts[2].length === 4) d = new Date(`${parts[2]}-${parts[1]}-${parts[0]}T00:00:00`);
    else d = new Date(dateStr);
  } else {
    d = new Date(dateStr + "T00:00:00");
  }
  if (isNaN(d)) return null;
  const today = new Date(); today.setHours(0,0,0,0);
  return Math.floor((today - d) / 86400000);
}

function getAlerta(dias) {
  if (dias === null) return { label: "—", bg: "#f8fafc", text: "#94a3b8", border: "#e2e8f0", priority: 4 };
  if (dias > 90) return { label: "CRÍTICO", bg: "#fef2f2", text: "#991b1b", border: "#fca5a5", priority: 0 };
  if (dias > 60) return { label: "ATENÇÃO", bg: "#fffbeb", text: "#92400e", border: "#fcd34d", priority: 1 };
  if (dias > 30) return { label: "MONITORAR", bg: "#eff6ff", text: "#1e40af", border: "#93c5fd", priority: 2 };
  return { label: "OK", bg: "#f0fdf4", text: "#166534", border: "#86efac", priority: 3 };
}

function getAlertaCliente(dias) {
  if (dias === null) return { label: "—", bg: "#f8fafc", text: "#94a3b8", border: "#e2e8f0" };
  if (dias > 60) return { label: "URGENTE", bg: "#fef2f2", text: "#991b1b", border: "#fca5a5" };
  if (dias > 30) return { label: "ATRASO", bg: "#fffbeb", text: "#92400e", border: "#fcd34d" };
  if (dias > 15) return { label: "PENDENTE", bg: "#eff6ff", text: "#1e40af", border: "#93c5fd" };
  return { label: "EM DIA", bg: "#f0fdf4", text: "#166534", border: "#86efac" };
}

function formatDate(dateStr) {
  if (!dateStr) return "—";
  if (dateStr.includes("/")) return dateStr;
  const [y, m, d] = dateStr.split("-");
  return `${d}/${m}/${y}`;
}

function Badge({ alerta, small }) {
  return (
    <span style={{
      display: "inline-block", padding: small ? "2px 8px" : "4px 12px",
      borderRadius: "20px", fontSize: small ? "9px" : "10px", fontWeight: 800,
      letterSpacing: "0.8px", background: alerta.bg, color: alerta.text,
      border: `1.5px solid ${alerta.border}`, whiteSpace: "nowrap"
    }}>{alerta.label}</span>
  );
}

function DeltaDisplay({ dias, label, alerta }) {
  const color = dias === null ? "#cbd5e1" : dias > 90 ? "#ef4444" : dias > 60 ? "#f59e0b" : dias > 30 ? "#3b82f6" : "#22c55e";
  return (
    <div style={{ textAlign: "center", minWidth: "80px" }}>
      <div style={{ fontSize: "10px", color: "#94a3b8", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.5px", marginBottom: "2px" }}>{label}</div>
      <div style={{ fontSize: "22px", fontWeight: 800, color, lineHeight: 1.1, fontFamily: "'Outfit', sans-serif" }}>{dias ?? "—"}</div>
      <div style={{ fontSize: "9px", color: "#94a3b8", marginBottom: "3px" }}>dias</div>
      <Badge alerta={alerta} small />
    </div>
  );
}

function Modal({ isOpen, onClose, processo, sheetId }) {
  if (!isOpen) return null;
  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 50, display: "flex", alignItems: "center", justifyContent: "center", backgroundColor: "rgba(15,23,42,0.55)", backdropFilter: "blur(6px)" }}>
      <div style={{ width: "500px", maxWidth: "90vw", background: "#fff", borderRadius: "16px", boxShadow: "0 25px 60px rgba(0,0,0,0.2)", overflow: "hidden" }}>
        <div style={{ padding: "24px 28px 16px", borderBottom: "1px solid #f1f5f9" }}>
          <h2 style={{ fontFamily: "'Playfair Display', Georgia, serif", fontSize: "20px", fontWeight: 700, color: "#0f172a", margin: 0 }}>
            {processo ? "Editar no Google Sheets" : "Adicionar Processo"}
          </h2>
        </div>
        <div style={{ padding: "24px 28px" }}>
          <p style={{ fontSize: "14px", color: "#475569", lineHeight: 1.7, margin: "0 0 8px" }}>
            {processo
              ? `Para editar o processo de "${processo.cliente}", abra a planilha e vá até a linha ${processo._rowIndex}.`
              : "Para adicionar um novo processo, insira uma nova linha na planilha do Google Sheets."
            }
          </p>
          <p style={{ fontSize: "13px", color: "#94a3b8", margin: "0 0 20px" }}>
            Após salvar na planilha, clique em "Atualizar Dados" no app para ver as alterações.
          </p>
          <a href={`https://docs.google.com/spreadsheets/d/${sheetId}/edit`} target="_blank" rel="noopener noreferrer"
            style={{ display: "inline-flex", alignItems: "center", gap: "8px", padding: "12px 24px", borderRadius: "10px", background: "linear-gradient(135deg, #0f766e, #14b8a6)", color: "#fff", fontSize: "14px", fontWeight: 700, textDecoration: "none", boxShadow: "0 4px 15px rgba(20,184,166,0.3)" }}>
            Abrir Google Sheets →
          </a>
        </div>
        <div style={{ padding: "16px 28px 24px", display: "flex", justifyContent: "flex-end" }}>
          <button onClick={onClose} style={{ padding: "10px 24px", borderRadius: "8px", border: "1.5px solid #e2e8f0", background: "#fff", fontSize: "14px", fontWeight: 500, cursor: "pointer", color: "#64748b" }}>Fechar</button>
        </div>
      </div>
    </div>
  );
}

function StatCard({ label, value, color, sub }) {
  return (
    <div style={{ background: "#fff", borderRadius: "14px", padding: "18px 20px", border: "1px solid #f1f5f9", position: "relative", overflow: "hidden", boxShadow: "0 1px 3px rgba(0,0,0,0.02)" }}>
      <div style={{ position: "absolute", top: 0, left: 0, width: "4px", height: "100%", background: color, borderRadius: "14px 0 0 14px" }} />
      <div style={{ fontSize: "11px", fontWeight: 700, color: "#94a3b8", textTransform: "uppercase", letterSpacing: "1px", marginBottom: "6px" }}>{label}</div>
      <div style={{ fontSize: "30px", fontWeight: 800, color, lineHeight: 1, fontFamily: "'Outfit', sans-serif" }}>{value}</div>
      {sub && <div style={{ fontSize: "11px", color: "#94a3b8", marginTop: "4px" }}>{sub}</div>}
    </div>
  );
}

export default function App() {
  const [processos, setProcessos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [lastUpdate, setLastUpdate] = useState(null);
  const [search, setSearch] = useState("");
  const [filterTipo, setFilterTipo] = useState("Todos");
  const [filterFase, setFilterFase] = useState("Todas");
  const [filterAlerta, setFilterAlerta] = useState("Todos");
  const [filterAlertaCliente, setFilterAlertaCliente] = useState("Todos");
  const [sortBy, setSortBy] = useState("diasProc");
  const [modalOpen, setModalOpen] = useState(false);
  const [modalProcesso, setModalProcesso] = useState(null);
  const [expandedId, setExpandedId] = useState(null);
  const [view, setView] = useState("list");

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(CSV_URL + "&_t=" + Date.now());
      if (!res.ok) throw new Error("Falha ao carregar dados");
      const text = await res.text();
      const data = parseCSV(text);
      setProcessos(data);
      setLastUpdate(new Date());
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const enriched = useMemo(() => processos.map(p => {
    const diasProc = diasDesde(p.dataMovimentacao);
    const diasCliente = diasDesde(p.dataPosicionamento);
    return { ...p, diasProc, alertaProc: getAlerta(diasProc), diasCliente, alertaCliente: getAlertaCliente(diasCliente) };
  }), [processos]);

  const filtered = useMemo(() => {
    let result = enriched.filter(p => {
      const s = search.toLowerCase();
      const matchSearch = !search || [p.numero, p.cliente, p.parteContraria, p.vara, p.situacao].some(f => f?.toLowerCase().includes(s));
      const matchTipo = filterTipo === "Todos" || p.tipo === filterTipo;
      const matchFase = filterFase === "Todas" || p.fase === filterFase;
      const matchAlerta = filterAlerta === "Todos" || p.alertaProc.label === filterAlerta;
      const matchAlertaCli = filterAlertaCliente === "Todos" || p.alertaCliente.label === filterAlertaCliente;
      return matchSearch && matchTipo && matchFase && matchAlerta && matchAlertaCli;
    });
    if (sortBy === "diasProc") result.sort((a, b) => (b.diasProc ?? -1) - (a.diasProc ?? -1));
    else if (sortBy === "diasCliente") result.sort((a, b) => (b.diasCliente ?? -1) - (a.diasCliente ?? -1));
    else if (sortBy === "cliente") result.sort((a, b) => (a.cliente || "").localeCompare(b.cliente || ""));
    else if (sortBy === "alerta") result.sort((a, b) => a.alertaProc.priority - b.alertaProc.priority);
    return result;
  }, [enriched, search, filterTipo, filterFase, filterAlerta, filterAlertaCliente, sortBy]);

  const stats = useMemo(() => ({
    total: enriched.length,
    critico: enriched.filter(p => p.alertaProc.label === "CRÍTICO").length,
    atencao: enriched.filter(p => p.alertaProc.label === "ATENÇÃO").length,
    semPosCliente: enriched.filter(p => p.alertaCliente.label === "URGENTE" || p.alertaCliente.label === "ATRASO").length,
  }), [enriched]);

  const selStyle = { padding: "8px 12px", borderRadius: "8px", border: "1.5px solid #e2e8f0", fontSize: "12px", background: "#fff", color: "#475569", outline: "none", cursor: "pointer" };

  return (
    <div style={{ minHeight: "100vh", background: "#f4f5f7", fontFamily: "'Outfit', -apple-system, sans-serif" }}>
      <style>{`
        @keyframes fadeUp { from { opacity:0; transform:translateY(12px); } to { opacity:1; transform:translateY(0); } }
        @keyframes pulse { 0%,100% { opacity:1; } 50% { opacity:0.6; } }
        .row-hover { transition: box-shadow 0.2s; }
        .row-hover:hover { box-shadow: 0 4px 16px rgba(0,0,0,0.06) !important; }
        .card-hover { transition: all 0.2s; }
        .card-hover:hover { transform: translateY(-3px) !important; box-shadow: 0 12px 28px rgba(0,0,0,0.08) !important; }
        * { box-sizing: border-box; }
        @media (max-width: 768px) {
          .grid-stats { grid-template-columns: 1fr 1fr !important; }
          .grid-filters { flex-direction: column !important; }
          .grid-filters > * { width: 100% !important; flex: none !important; }
          .list-row-grid { grid-template-columns: 1fr !important; gap: 8px !important; }
          .list-row-deltas { display: flex; gap: 16px; justify-content: center; margin-top: 8px; }
          .expanded-grid { grid-template-columns: 1fr !important; }
        }
      `}</style>

      {/* Header */}
      <div style={{ background: "linear-gradient(135deg, #0f172a 0%, #1e293b 60%, #0f172a 100%)", padding: "28px 28px 24px", position: "relative", overflow: "hidden" }}>
        <div style={{ position: "absolute", top: "-40px", right: "-40px", width: "200px", height: "200px", borderRadius: "50%", background: "radial-gradient(circle, rgba(20,184,166,0.08) 0%, transparent 70%)" }} />
        <div style={{ maxWidth: "1300px", margin: "0 auto", position: "relative" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: "16px", marginBottom: "24px" }}>
            <div>
              <h1 style={{ fontFamily: "'Playfair Display', Georgia, serif", fontSize: "26px", fontWeight: 800, color: "#fff", margin: "0 0 4px", letterSpacing: "-0.5px" }}>Controladoria Processual</h1>
              <p style={{ fontSize: "13px", color: "#64748b", margin: 0 }}>
                Direito de Família · {lastUpdate ? `Atualizado às ${lastUpdate.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}` : "Carregando..."}
              </p>
            </div>
            <div style={{ display: "flex", gap: "10px", flexWrap: "wrap" }}>
              <button onClick={fetchData} disabled={loading}
                style={{ padding: "10px 22px", borderRadius: "10px", border: "1.5px solid rgba(255,255,255,0.1)", background: "rgba(255,255,255,0.05)", color: "#e2e8f0", fontSize: "13px", fontWeight: 600, cursor: loading ? "wait" : "pointer", animation: loading ? "pulse 1.5s infinite" : "none" }}>
                {loading ? "Carregando..." : "↻ Atualizar Dados"}
              </button>
              <button onClick={() => { setModalProcesso(null); setModalOpen(true); }}
                style={{ padding: "10px 22px", borderRadius: "10px", border: "none", background: "linear-gradient(135deg, #0f766e, #14b8a6)", color: "#fff", fontSize: "13px", fontWeight: 700, cursor: "pointer", boxShadow: "0 4px 15px rgba(20,184,166,0.3)" }}>
                + Novo Processo
              </button>
            </div>
          </div>
          <div className="grid-stats" style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: "12px" }}>
            <StatCard label="Total Ativos" value={stats.total} color="#6366f1" />
            <StatCard label="Proc. Críticos" value={stats.critico} color="#ef4444" sub="+90 dias s/ movimentação" />
            <StatCard label="Proc. Atenção" value={stats.atencao} color="#f59e0b" sub="61-90 dias s/ movimentação" />
            <StatCard label="Clientes s/ Retorno" value={stats.semPosCliente} color="#f97316" sub="+30 dias s/ posicionamento" />
          </div>
        </div>
      </div>

      {/* Filters */}
      <div style={{ maxWidth: "1300px", margin: "0 auto", padding: "16px 28px 0" }}>
        <div className="grid-filters" style={{ background: "#fff", borderRadius: "12px", padding: "14px 18px", display: "flex", flexWrap: "wrap", gap: "10px", alignItems: "center", boxShadow: "0 1px 2px rgba(0,0,0,0.03)" }}>
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Buscar cliente, nº processo, vara..."
            style={{ flex: "1 1 200px", padding: "9px 14px", borderRadius: "8px", border: "1.5px solid #e2e8f0", fontSize: "13px", outline: "none" }}
            onFocus={e => e.target.style.borderColor="#14b8a6"} onBlur={e => e.target.style.borderColor="#e2e8f0"} />
          <select value={filterTipo} onChange={e => setFilterTipo(e.target.value)} style={selStyle}>
            <option>Todos</option>{TIPOS_ACAO.map(t => <option key={t}>{t}</option>)}
          </select>
          <select value={filterFase} onChange={e => setFilterFase(e.target.value)} style={selStyle}>
            <option>Todas</option>{FASES.map(f => <option key={f}>{f}</option>)}
          </select>
          <select value={filterAlerta} onChange={e => setFilterAlerta(e.target.value)} style={selStyle}>
            <option value="Todos">Δ Processo</option>
            <option>CRÍTICO</option><option>ATENÇÃO</option><option>MONITORAR</option><option>OK</option>
          </select>
          <select value={filterAlertaCliente} onChange={e => setFilterAlertaCliente(e.target.value)} style={selStyle}>
            <option value="Todos">Δ Cliente</option>
            <option>URGENTE</option><option>ATRASO</option><option>PENDENTE</option><option>EM DIA</option>
          </select>
          <select value={sortBy} onChange={e => setSortBy(e.target.value)} style={selStyle}>
            <option value="diasProc">Ordenar: Δ Processo</option>
            <option value="diasCliente">Ordenar: Δ Cliente</option>
            <option value="cliente">Ordenar: Cliente A-Z</option>
            <option value="alerta">Ordenar: Prioridade</option>
          </select>
          <div style={{ display: "flex", gap: "2px", background: "#f1f5f9", borderRadius: "8px", padding: "3px" }}>
            {["list", "cards"].map(v => (
              <button key={v} onClick={() => setView(v)} style={{ padding: "5px 14px", borderRadius: "6px", border: "none", background: view === v ? "#fff" : "transparent", boxShadow: view === v ? "0 1px 3px rgba(0,0,0,0.08)" : "none", cursor: "pointer", fontSize: "12px", fontWeight: 700, color: view === v ? "#0f766e" : "#94a3b8" }}>
                {v === "list" ? "Lista" : "Cards"}
              </button>
            ))}
          </div>
        </div>
      </div>

      {error && (
        <div style={{ maxWidth: "1300px", margin: "16px auto 0", padding: "0 28px" }}>
          <div style={{ background: "#fef2f2", border: "1px solid #fca5a5", borderRadius: "10px", padding: "14px 18px", fontSize: "13px", color: "#991b1b" }}>
            Erro ao carregar: {error}. Verifique se a planilha está publicada na web.
            <button onClick={fetchData} style={{ marginLeft: "12px", padding: "4px 14px", borderRadius: "6px", border: "1px solid #fca5a5", background: "#fff", cursor: "pointer", fontSize: "12px", fontWeight: 600, color: "#991b1b" }}>Tentar novamente</button>
          </div>
        </div>
      )}

      {/* Content */}
      <div style={{ maxWidth: "1300px", margin: "0 auto", padding: "14px 28px 40px" }}>
        <div style={{ fontSize: "12px", color: "#94a3b8", marginBottom: "10px", fontWeight: 500 }}>
          {filtered.length} processo{filtered.length !== 1 ? "s" : ""} · {enriched.length} total
        </div>

        {loading && processos.length === 0 ? (
          <div style={{ textAlign: "center", padding: "80px 20px", color: "#94a3b8" }}>
            <div style={{ fontSize: "32px", marginBottom: "12px", animation: "pulse 1.5s infinite" }}>⟳</div>
            <div style={{ fontSize: "15px", fontWeight: 600 }}>Carregando processos do Google Sheets...</div>
          </div>
        ) : view === "list" ? (
          <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
            {filtered.map((p, idx) => (
              <div key={p.id + "-" + idx} className="row-hover" style={{ background: "#fff", borderRadius: "12px", border: "1px solid #f1f5f9", overflow: "hidden", animation: `fadeUp 0.3s ease ${Math.min(idx * 0.03, 0.5)}s both` }}>
                <div onClick={() => setExpandedId(expandedId === p.id ? null : p.id)} className="list-row-grid" style={{ padding: "14px 18px", cursor: "pointer", display: "grid", gridTemplateColumns: "1.5fr auto 80px 80px", gap: "14px", alignItems: "center" }}>
                  <div>
                    <div style={{ fontSize: "14px", fontWeight: 700, color: "#0f172a", marginBottom: "2px" }}>
                      {p.cliente || "—"} <span style={{ fontWeight: 400, color: "#cbd5e1", margin: "0 2px" }}>×</span> <span style={{ fontWeight: 500, color: "#64748b" }}>{p.parteContraria || "—"}</span>
                    </div>
                    <div style={{ fontSize: "11px", color: "#94a3b8" }}>
                      {p.numero} · {p.vara} · <span style={{ color: "#64748b", fontWeight: 500 }}>{p.tipo}</span> · <span style={{ background: "#f1f5f9", padding: "1px 7px", borderRadius: "4px", fontWeight: 600, color: "#475569" }}>{p.fase}</span>
                    </div>
                  </div>
                  <div style={{ fontSize: "12px", color: "#94a3b8", maxWidth: "200px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{p.situacao}</div>
                  <DeltaDisplay dias={p.diasProc} label="Δ Processo" alerta={p.alertaProc} />
                  <DeltaDisplay dias={p.diasCliente} label="Δ Cliente" alerta={p.alertaCliente} />
                </div>

                {expandedId === p.id && (
                  <div style={{ padding: "0 18px 18px", borderTop: "1px solid #f8fafc", animation: "fadeUp 0.2s ease" }}>
                    <div className="expanded-grid" style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "16px", marginTop: "14px" }}>
                      <div>
                        <div style={{ fontSize: "10px", fontWeight: 700, color: "#94a3b8", textTransform: "uppercase", letterSpacing: "0.8px", marginBottom: "5px" }}>Situação Atual</div>
                        <div style={{ fontSize: "13px", color: "#334155", lineHeight: 1.6 }}>{p.situacao || "—"}</div>
                      </div>
                      <div>
                        <div style={{ fontSize: "10px", fontWeight: 700, color: "#94a3b8", textTransform: "uppercase", letterSpacing: "0.8px", marginBottom: "5px" }}>Última Movimentação</div>
                        <div style={{ fontSize: "13px", color: "#334155", lineHeight: 1.6 }}>{p.ultimaMovimentacao || "—"}</div>
                        <div style={{ fontSize: "11px", color: "#94a3b8", marginTop: "4px" }}>📅 {formatDate(p.dataMovimentacao)}</div>
                      </div>
                      <div>
                        <div style={{ fontSize: "10px", fontWeight: 700, color: "#94a3b8", textTransform: "uppercase", letterSpacing: "0.8px", marginBottom: "5px" }}>Último Posicionamento ao Cliente</div>
                        <div style={{ fontSize: "13px", color: "#334155", lineHeight: 1.6 }}>{p.ultimoPosicionamento || "—"}</div>
                        <div style={{ fontSize: "11px", color: "#94a3b8", marginTop: "4px" }}>📅 {formatDate(p.dataPosicionamento)}</div>
                      </div>
                    </div>
                    <div style={{ display: "flex", gap: "8px", marginTop: "14px", justifyContent: "flex-end" }}>
                      <button onClick={(e) => { e.stopPropagation(); setModalProcesso(p); setModalOpen(true); }}
                        style={{ padding: "7px 18px", borderRadius: "8px", border: "1.5px solid #e2e8f0", background: "#fff", fontSize: "12px", fontWeight: 600, cursor: "pointer", color: "#0f766e" }}>
                        Editar na Planilha →
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        ) : (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(320px, 1fr))", gap: "14px" }}>
            {filtered.map((p, idx) => (
              <div key={p.id + "-" + idx} className="card-hover" style={{ background: "#fff", borderRadius: "14px", padding: "18px", border: "1px solid #f1f5f9", animation: `fadeUp 0.3s ease ${Math.min(idx * 0.04, 0.5)}s both` }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "10px" }}>
                  <div>
                    <div style={{ fontSize: "15px", fontWeight: 700, color: "#0f172a" }}>{p.cliente || "—"}</div>
                    <div style={{ fontSize: "11px", color: "#94a3b8" }}>vs {p.parteContraria || "—"}</div>
                  </div>
                  <Badge alerta={p.alertaProc} />
                </div>
                <div style={{ fontSize: "11px", color: "#64748b", marginBottom: "10px" }}>{p.numero}</div>
                <div style={{ display: "flex", gap: "6px", marginBottom: "10px", flexWrap: "wrap" }}>
                  <span style={{ background: "#f1f5f9", padding: "3px 10px", borderRadius: "6px", fontSize: "11px", fontWeight: 600, color: "#475569" }}>{p.tipo}</span>
                  <span style={{ background: "#f0fdf4", padding: "3px 10px", borderRadius: "6px", fontSize: "11px", fontWeight: 600, color: "#166534" }}>{p.fase}</span>
                </div>
                <div style={{ fontSize: "12px", color: "#475569", lineHeight: 1.5, marginBottom: "12px", minHeight: "36px" }}>{p.situacao || "—"}</div>
                <div style={{ display: "flex", justifyContent: "space-around", borderTop: "1px solid #f1f5f9", paddingTop: "14px" }}>
                  <DeltaDisplay dias={p.diasProc} label="Δ Processo" alerta={p.alertaProc} />
                  <div style={{ width: "1px", background: "#f1f5f9" }} />
                  <DeltaDisplay dias={p.diasCliente} label="Δ Cliente" alerta={p.alertaCliente} />
                </div>
                <div style={{ marginTop: "12px", textAlign: "right" }}>
                  <button onClick={() => { setModalProcesso(p); setModalOpen(true); }}
                    style={{ padding: "6px 16px", borderRadius: "6px", border: "1.5px solid #e2e8f0", background: "#fff", fontSize: "11px", fontWeight: 600, cursor: "pointer", color: "#0f766e" }}>
                    Editar na Planilha →
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        {!loading && filtered.length === 0 && (
          <div style={{ textAlign: "center", padding: "60px 20px", color: "#94a3b8" }}>
            <div style={{ fontSize: "42px", marginBottom: "12px" }}>📋</div>
            <div style={{ fontSize: "15px", fontWeight: 600 }}>Nenhum processo encontrado</div>
            <div style={{ fontSize: "13px", marginTop: "4px" }}>
              {processos.length === 0 ? "Adicione processos na planilha do Google Sheets" : "Ajuste os filtros de busca"}
            </div>
          </div>
        )}
      </div>

      <Modal isOpen={modalOpen} onClose={() => setModalOpen(false)} processo={modalProcesso} sheetId={SHEET_ID} />
    </div>
  );
}
