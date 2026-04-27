import { useState, useCallback, useEffect, MouseEvent, ReactNode } from 'react';

/* ══════════════════════════════════════════════
   TYPES
══════════════════════════════════════════════ */
type Op = '+' | '−' | '×' | '÷' | null;
interface HistEntry { expr: string; result: string; }

/* ══════════════════════════════════════════════
   HELPERS
══════════════════════════════════════════════ */
function fmt(n: string): string {
  if (['Erro', '∞', '-∞'].includes(n)) return n;
  const hasDot = n.includes('.');
  const [int, dec] = n.split('.');
  const formatted = Number(int).toLocaleString('pt-BR');
  return hasDot ? `${formatted},${dec}` : formatted;
}



function compute(a: string, b: string, op: Op): string {
  const fa = parseFloat(a);
  const fb = parseFloat(b);
  if (isNaN(fa) || isNaN(fb)) return 'Erro';
  let r: number;
  switch (op) {
    case '+': r = fa + fb; break;
    case '−': r = fa - fb; break;
    case '×': r = fa * fb; break;
    case '÷':
      if (fb === 0) return fa === 0 ? 'Erro' : '∞';
      r = fa / fb;
      break;
    default: return a;
  }
  const fixed = parseFloat(r.toPrecision(12));
  return String(fixed);
}

function clamp(n: string): string {
  if (['Erro', '∞', '-∞'].includes(n)) return n;
  const v = parseFloat(n);
  if (Math.abs(v) >= 1e15) return v.toExponential(4);
  return n;
}

function shrinkClass(val: string): string {
  const len = val.replace(/[^0-9eE.]/g, '').length;
  if (len > 12) return 'shrink-3';
  if (len > 9)  return 'shrink-2';
  if (len > 7)  return 'shrink-1';
  return '';
}

function useClock() {
  const [t, setT] = useState(() =>
    new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
  );
  useEffect(() => {
    const id = setInterval(() =>
      setT(new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })),
      15_000
    );
    return () => clearInterval(id);
  }, []);
  return t;
}

/* ══════════════════════════════════════════════
   RIPPLE hook
══════════════════════════════════════════════ */
function useRipple() {
  return (e: MouseEvent<HTMLButtonElement>) => {
    const btn = e.currentTarget;
    const rect = btn.getBoundingClientRect();
    const el = document.createElement('span');
    el.className = 'ripple-el';
    el.style.left = `${e.clientX - rect.left - 22}px`;
    el.style.top  = `${e.clientY - rect.top  - 22}px`;
    btn.appendChild(el);
    setTimeout(() => el.remove(), 500);
  };
}

/* ══════════════════════════════════════════════
   TOOLTIP BUTTON
══════════════════════════════════════════════ */
interface TBtnProps {
  tip: string;
  cls?: string;
  style?: React.CSSProperties;
  onClick?: (e: MouseEvent<HTMLButtonElement>) => void;
  children: ReactNode;
  label?: string;
}
function TBtn({ tip, cls = '', style, onClick, children, label }: TBtnProps) {
  const ripple = useRipple();
  return (
    <div className="tt-wrap">
      <button
        className={`calc-btn ${cls}`}
        style={style}
        aria-label={label || tip}
        onClick={(e) => { ripple(e); onClick?.(e); }}
      >
        {children}
      </button>
      <span className="tt-bubble">{tip}</span>
    </div>
  );
}

/* ══════════════════════════════════════════════
   MAIN APP
══════════════════════════════════════════════ */
export default function App() {
  const [display,    setDisplay]    = useState('0');
  const [expr,       setExpr]       = useState('');
  const [operand,    setOperand]    = useState<string | null>(null);
  const [operator,   setOperator]   = useState<Op>(null);
  const [waitNew,    setWaitNew]    = useState(false);
  const [activeOp,   setActiveOp]   = useState<Op>(null);
  const [history,    setHistory]    = useState<HistEntry[]>([]);
  const [showHist,   setShowHist]   = useState(false);
  const [sciOpen,    setSciOpen]    = useState(false);
  const [dispKey,    setDispKey]    = useState(0);
  const [justEval,   setJustEval]   = useState(false);

  const clock = useClock();
  const pop = () => setDispKey(k => k + 1);

  /* ── digit ── */
  const onDigit = useCallback((d: string) => {
    if (waitNew || justEval) {
      setDisplay(d === '.' ? '0.' : d);
      setWaitNew(false);
      setJustEval(false);
      pop();
    } else {
      if (d === '.' && display.includes('.')) return;
      const digits = display.replace(/[^0-9]/g, '').length;
      if (digits >= 12 && d !== '.') return;
      if (display === '0' && d !== '.') { setDisplay(d); pop(); }
      else { setDisplay(p => p + d); }
    }
    setActiveOp(null);
  }, [display, waitNew, justEval]);

  /* ── operator ── */
  const onOp = useCallback((op: Op) => {
    if (operator && !waitNew && !justEval && operand !== null) {
      const r = clamp(compute(operand, display, operator));
      setDisplay(r);
      setExpr(`${fmt(operand)} ${operator} ${fmt(display)} =`);
      setOperand(r);
      pop();
    } else {
      setOperand(display);
    }
    setOperator(op);
    setActiveOp(op);
    setWaitNew(true);
    setJustEval(false);
    setExpr(`${fmt(display)} ${op}`);
  }, [display, operator, operand, waitNew, justEval]);

  /* ── equals ── */
  const onEqual = useCallback(() => {
    if (!operator || operand === null) return;
    const r = clamp(compute(operand, display, operator));
    const expression = `${fmt(operand)} ${operator} ${fmt(display)} =`;
    setExpr(expression);
    setHistory(prev => [{ expr: expression, result: fmt(r) }, ...prev.slice(0, 49)]);
    setDisplay(r);
    setOperand(null);
    setOperator(null);
    setActiveOp(null);
    setWaitNew(false);
    setJustEval(true);
    pop();
  }, [operator, operand, display]);

  /* ── clear ── */
  const onClear = useCallback(() => {
    setDisplay('0');
    setExpr('');
    setOperand(null);
    setOperator(null);
    setActiveOp(null);
    setWaitNew(false);
    setJustEval(false);
    pop();
  }, []);

  /* ── toggle sign ── */
  const onSign = useCallback(() => {
    if (display === '0') return;
    setDisplay(p => p.startsWith('-') ? p.slice(1) : '-' + p);
    pop();
  }, [display]);

  /* ── percent ── */
  const onPct = useCallback(() => {
    const n = parseFloat(display);
    if (isNaN(n)) return;
    const r = operand ? String(parseFloat(operand) * (n / 100)) : String(n / 100);
    setDisplay(clamp(r));
    pop();
  }, [display, operand]);

  /* ── backspace ── */
  const onBack = useCallback(() => {
    if (justEval || ['Erro', '∞', '-∞'].includes(display)) {
      setDisplay('0'); setJustEval(false); pop(); return;
    }
    const nd = display.length <= 1 || (display.length === 2 && display.startsWith('-'))
      ? '0'
      : display.slice(0, -1);
    setDisplay(nd);
    pop();
  }, [display, justEval]);

  /* ── scientific ── */
  const onSci = useCallback((fn: string) => {
    const n = parseFloat(display);
    if (isNaN(n)) return;
    let r: number;
    let label = '';
    const deg2rad = Math.PI / 180;
    switch (fn) {
      case 'sin': r = Math.sin(n * deg2rad);  label = `sin(${n}°)`; break;
      case 'cos': r = Math.cos(n * deg2rad);  label = `cos(${n}°)`; break;
      case 'tan': r = Math.tan(n * deg2rad);  label = `tan(${n}°)`; break;
      case '√':   r = Math.sqrt(n);           label = `√(${n})`;    break;
      case 'x²':  r = n ** 2;                 label = `(${n})²`;    break;
      case 'x³':  r = n ** 3;                 label = `(${n})³`;    break;
      case 'ln':  r = Math.log(n);            label = `ln(${n})`;   break;
      case 'log': r = Math.log10(n);          label = `log(${n})`;  break;
      case '1/x': r = 1 / n;                  label = `1/(${n})`;   break;
      case 'π':   r = Math.PI;                label = 'π';          break;
      case 'e':   r = Math.E;                 label = 'e';          break;
      case '!': {
        let f = 1;
        const ni = Math.round(Math.abs(n));
        for (let i = 2; i <= Math.min(ni, 170); i++) f *= i;
        r = f; label = `${ni}!`;
        break;
      }
      default: return;
    }
    const res = clamp(String(parseFloat(r.toPrecision(12))));
    const expression = `${label} =`;
    setExpr(expression);
    setHistory(prev => [{ expr: expression, result: fmt(res) }, ...prev.slice(0, 49)]);
    setDisplay(res);
    setJustEval(true);
    setOperand(null);
    setOperator(null);
    pop();
  }, [display]);

  /* ── keyboard ── */
  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      if (e.key >= '0' && e.key <= '9') onDigit(e.key);
      else if (e.key === ',' || e.key === '.') onDigit('.');
      else if (e.key === '+') onOp('+');
      else if (e.key === '-') onOp('−');
      else if (e.key === '*') onOp('×');
      else if (e.key === '/') { e.preventDefault(); onOp('÷'); }
      else if (e.key === 'Enter' || e.key === '=') onEqual();
      else if (e.key === 'Escape') onClear();
      else if (e.key === 'Backspace') onBack();
      else if (e.key === '%') onPct();
    };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, [onDigit, onOp, onEqual, onClear, onBack, onPct]);

  const isErr = ['Erro', '∞', '-∞'].includes(display);
  const acLabel = (display === '0' && !operand) ? 'AC' : 'C';

  const sciBtns = [
    { f: 'sin',  tip: 'Seno (graus)'          },
    { f: 'cos',  tip: 'Cosseno (graus)'        },
    { f: 'tan',  tip: 'Tangente (graus)'       },
    { f: '√',    tip: 'Raiz quadrada'          },
    { f: 'x²',   tip: 'Elevar ao quadrado'     },
    { f: 'x³',   tip: 'Elevar ao cubo'         },
    { f: 'ln',   tip: 'Logaritmo natural'      },
    { f: 'log',  tip: 'Log base 10'            },
    { f: '1/x',  tip: 'Inverso (recíproco)'   },
    { f: 'π',    tip: 'Pi ≈ 3.14159…'          },
    { f: 'e',    tip: 'Número de Euler ≈ 2.71' },
    { f: '!',    tip: 'Fatorial (n!)'          },
  ];

  const ripple = useRipple();

  return (
    <>
      {/* BG */}
      <div className="calc-bg" />

      <div className="calc-shell">
        <div className="phone-frame">
          <div className="liquid-panel">

            {/* ── Status bar ── */}
            <div className="status-bar">
              <span className="status-time">{clock}</span>
              <div className="status-icons">
                {/* Signal bars */}
                <svg viewBox="0 0 17 14" fill="currentColor">
                  <rect x="0"  y="8"  width="3.5" height="6"  rx="1" opacity="0.35"/>
                  <rect x="4.5" y="5" width="3.5" height="9"  rx="1" opacity="0.6"/>
                  <rect x="9"  y="2"  width="3.5" height="12" rx="1" opacity="0.8"/>
                  <rect x="13.5" y="0" width="3.5" height="14" rx="1"/>
                </svg>
                {/* WiFi */}
                <svg viewBox="0 0 18 14" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round">
                  <path d="M1 4.5C5 0.5 13 0.5 17 4.5"/>
                  <path d="M3.5 7.5C6.2 4.8 11.8 4.8 14.5 7.5"/>
                  <path d="M6.5 10.5C7.8 9.2 10.2 9.2 11.5 10.5"/>
                  <circle cx="9" cy="13" r="1.2" fill="currentColor" stroke="none"/>
                </svg>
                {/* Battery */}
                <svg viewBox="0 0 26 13" fill="currentColor">
                  <rect x="0" y="0.5" width="23" height="12" rx="3.5" fill="none" stroke="currentColor" strokeWidth="1.2"/>
                  <rect x="1.5" y="2" width="18" height="9" rx="2"/>
                  <path d="M24.5 4.5v4a2.3 2.3 0 000-4z"/>
                </svg>
              </div>
            </div>

            {/* ── Dynamic Island ── */}
            <div className="dynamic-island">
              <div className="di-dot" />
              <div className="di-dot cam" />
            </div>

            {/* ── Control strip ── */}
            <div className="control-strip">
              {/* Dark mode pill (decorative) */}
              <div className="tt-wrap">
                <button className="ctrl-pill" aria-label="Modo escuro ativo">
                  <svg viewBox="0 0 20 20" fill="currentColor">
                    <path d="M17.293 13.293A8 8 0 016.707 2.707a8.001 8.001 0 1010.586 10.586z"/>
                  </svg>
                  Escuro
                </button>
                <span className="tt-bubble">Tema iOS 26 · Liquid Glass</span>
              </div>

              {/* Scientific toggle */}
              <div className="tt-wrap">
                <button
                  className={`ctrl-pill ${sciOpen ? 'sci-active' : ''}`}
                  onClick={() => setSciOpen(o => !o)}
                  aria-label={sciOpen ? 'Fechar funções científicas' : 'Abrir funções científicas'}
                >
                  <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                    <path d="M2 10h16M10 2v16"/>
                  </svg>
                  Científica
                </button>
                <span className="tt-bubble">{sciOpen ? 'Fechar funções científicas' : 'Abrir funções científicas'}</span>
              </div>
            </div>

            {/* ── Display ── */}
            <div className="display-area">
              {/* History chip */}
              {history.length > 0 && (
                <div className="tt-wrap" style={{ alignSelf: 'flex-end' }}>
                  <button
                    className="history-chip"
                    onClick={() => setShowHist(true)}
                    aria-label="Abrir histórico"
                  >
                    <svg width="13" height="13" viewBox="0 0 20 20" fill="currentColor">
                      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-12a1 1 0 10-2 0v4a1 1 0 00.293.707l2.828 2.829a1 1 0 101.415-1.415L11 9.586V6z"/>
                    </svg>
                    {history.length} cálculo{history.length !== 1 ? 's' : ''}
                  </button>
                  <span className="tt-bubble">Ver histórico de cálculos</span>
                </div>
              )}

              {/* Expression */}
              <div className="expression-line" aria-live="polite">
                {expr}
              </div>

              {/* Main number */}
              <div
                key={dispKey}
                className={`main-display display-pop ${shrinkClass(fmt(display))} ${isErr ? 'glow-err' : ''}`}
                role="status"
                aria-live="assertive"
                aria-label={`Resultado: ${fmt(display)}`}
              >
                {isErr ? display : fmt(display)}
              </div>
            </div>

            {/* ── Scientific drawer ── */}
            <div className={`sci-drawer ${sciOpen ? 'open' : ''}`}>
              <div className="sci-grid">
                {sciBtns.map(b => (
                  <div key={b.f} className="tt-wrap">
                    <button
                      className="btn-sci"
                      onClick={() => onSci(b.f)}
                      aria-label={b.tip}
                    >
                      {b.f}
                    </button>
                    <span className="tt-bubble">{b.tip}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* ══ BUTTON GRID ══ */}
            <div className="btn-grid">

              {/* Row 1 — AC/C  ±  %  ÷ */}
              <TBtn tip={acLabel === 'AC' ? 'Limpar tudo' : 'Apagar entrada'}
                    cls="btn-mid" onClick={onClear} label={acLabel}>
                <span style={{ fontSize: 28, fontWeight: 600 }}>{acLabel}</span>
              </TBtn>

              <TBtn tip="Inverter sinal (+/−)" cls="btn-mid" onClick={onSign} label="Inverter sinal">
                <svg width="28" height="28" viewBox="0 0 32 32" fill="none"
                     stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                  <circle cx="10" cy="22" r="6" stroke="currentColor" strokeWidth="2"/>
                  <line x1="7" y1="22" x2="13" y2="22"/>
                  <circle cx="22" cy="10" r="6" stroke="currentColor" strokeWidth="2"/>
                  <line x1="19" y1="10" x2="25" y2="10"/>
                  <line x1="22" y1="7"  x2="22" y2="13"/>
                </svg>
              </TBtn>

              <TBtn tip="Porcentagem (%)" cls="btn-mid" onClick={onPct} label="Porcentagem">
                <span style={{ fontSize: 30, fontWeight: 400 }}>%</span>
              </TBtn>

              <TBtn tip="Dividir" cls={`btn-orange ${activeOp === '÷' ? 'op-active' : ''}`}
                    onClick={() => onOp('÷')} label="Dividir">
                <span style={{ fontSize: 36, fontWeight: 300, lineHeight: 1 }}>÷</span>
              </TBtn>

              {/* Row 2 — 7 8 9 × */}
              <TBtn tip="7" cls="btn-dark" onClick={() => onDigit('7')} label="Número 7">
                <span style={{ fontSize: 34, fontWeight: 400 }}>7</span>
              </TBtn>
              <TBtn tip="8" cls="btn-dark" onClick={() => onDigit('8')} label="Número 8">
                <span style={{ fontSize: 34, fontWeight: 400 }}>8</span>
              </TBtn>
              <TBtn tip="9" cls="btn-dark" onClick={() => onDigit('9')} label="Número 9">
                <span style={{ fontSize: 34, fontWeight: 400 }}>9</span>
              </TBtn>
              <TBtn tip="Multiplicar" cls={`btn-orange ${activeOp === '×' ? 'op-active' : ''}`}
                    onClick={() => onOp('×')} label="Multiplicar">
                <span style={{ fontSize: 36, fontWeight: 300 }}>×</span>
              </TBtn>

              {/* Row 3 — 4 5 6 − */}
              <TBtn tip="4" cls="btn-dark" onClick={() => onDigit('4')} label="Número 4">
                <span style={{ fontSize: 34, fontWeight: 400 }}>4</span>
              </TBtn>
              <TBtn tip="5" cls="btn-dark" onClick={() => onDigit('5')} label="Número 5">
                <span style={{ fontSize: 34, fontWeight: 400 }}>5</span>
              </TBtn>
              <TBtn tip="6" cls="btn-dark" onClick={() => onDigit('6')} label="Número 6">
                <span style={{ fontSize: 34, fontWeight: 400 }}>6</span>
              </TBtn>
              <TBtn tip="Subtrair" cls={`btn-orange ${activeOp === '−' ? 'op-active' : ''}`}
                    onClick={() => onOp('−')} label="Subtrair">
                <span style={{ fontSize: 40, fontWeight: 300, lineHeight: 1 }}>−</span>
              </TBtn>

              {/* Row 4 — 1 2 3 + */}
              <TBtn tip="1" cls="btn-dark" onClick={() => onDigit('1')} label="Número 1">
                <span style={{ fontSize: 34, fontWeight: 400 }}>1</span>
              </TBtn>
              <TBtn tip="2" cls="btn-dark" onClick={() => onDigit('2')} label="Número 2">
                <span style={{ fontSize: 34, fontWeight: 400 }}>2</span>
              </TBtn>
              <TBtn tip="3" cls="btn-dark" onClick={() => onDigit('3')} label="Número 3">
                <span style={{ fontSize: 34, fontWeight: 400 }}>3</span>
              </TBtn>
              <TBtn tip="Somar" cls={`btn-orange ${activeOp === '+' ? 'op-active' : ''}`}
                    onClick={() => onOp('+')} label="Somar">
                <span style={{ fontSize: 36, fontWeight: 300 }}>+</span>
              </TBtn>

              {/* Row 5 — 0 (wide)  .  = */}
              <TBtn tip="0" cls="btn-dark btn-zero" onClick={() => onDigit('0')} label="Número 0">
                <span style={{ fontSize: 34, fontWeight: 400 }}>0</span>
              </TBtn>

              <TBtn tip="Vírgula decimal" cls="btn-dark" onClick={() => onDigit('.')} label="Vírgula">
                <span style={{ fontSize: 44, fontWeight: 700, lineHeight: 1, paddingBottom: 6 }}>.</span>
              </TBtn>

              <TBtn tip="Calcular resultado (=)" cls="btn-orange" onClick={onEqual} label="Igual">
                <span style={{ fontSize: 36, fontWeight: 400 }}>=</span>
              </TBtn>

            </div>{/* end btn-grid */}

            {/* ── Backspace row ── */}
            <div className="backspace-row">
              <div className="tt-wrap">
                <button
                  className="btn-back"
                  onClick={(e) => { ripple(e as MouseEvent<HTMLButtonElement>); onBack(); }}
                  aria-label="Apagar último dígito"
                >
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none"
                       stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M21 4H8l-7 8 7 8h13a2 2 0 002-2V6a2 2 0 00-2-2z"/>
                    <line x1="18" y1="9"  x2="12" y2="15"/>
                    <line x1="12" y1="9"  x2="18" y2="15"/>
                  </svg>
                </button>
                <span className="tt-bubble">Apagar último dígito (⌫)</span>
              </div>
            </div>

          </div>{/* end liquid-panel */}

          {/* ══ HISTORY PANEL ══ */}
          <div
            className={`history-panel ${showHist ? 'visible' : ''}`}
            role="dialog"
            aria-modal="true"
            aria-label="Histórico de cálculos"
          >
            <div className="history-header">
              <h2>Histórico</h2>
              {history.length > 0 && (
                <button
                  className="history-clear-btn"
                  onClick={() => setHistory([])}
                  aria-label="Limpar histórico"
                >
                  Limpar tudo
                </button>
              )}
            </div>

            <div className="history-list">
              {history.length === 0 ? (
                <div className="empty-history">
                  <svg viewBox="0 0 52 52" fill="none" stroke="currentColor" strokeWidth="1.8">
                    <circle cx="26" cy="26" r="22"/>
                    <path d="M26 14v12l8 8"/>
                  </svg>
                  <span>Nenhum cálculo ainda</span>
                  <span style={{ fontSize: 13, opacity: 0.6 }}>Faça uma operação para ver aqui</span>
                </div>
              ) : (
                history.map((h, i) => (
                  <div
                    key={i}
                    className="history-item"
                    role="button"
                    tabIndex={0}
                    aria-label={`${h.expr} resultado ${h.result}. Clique para usar.`}
                    onClick={() => {
                      // strip locale formatting back to raw number
                      const raw = h.result
                        .replace(/\./g, '')
                        .replace(',', '.');
                      setDisplay(String(parseFloat(raw)));
                      setJustEval(true);
                      setShowHist(false);
                      pop();
                    }}
                    onKeyDown={e => {
                      if (e.key === 'Enter') {
                        const raw = h.result.replace(/\./g, '').replace(',', '.');
                        setDisplay(String(parseFloat(raw)));
                        setJustEval(true);
                        setShowHist(false);
                        pop();
                      }
                    }}
                  >
                    <div className="hi-expr">{h.expr}</div>
                    <div className="hi-result">{h.result}</div>
                  </div>
                ))
              )}
            </div>

            <button
              className="history-close-btn"
              onClick={() => setShowHist(false)}
              aria-label="Fechar histórico"
            >
              Fechar
            </button>
          </div>

        </div>{/* end phone-frame */}
      </div>

      <div className="calc-footer">
        iOS 26 · Liquid Glass Calculator · Suporte a teclado ⌨️
      </div>
    </>
  );
}
