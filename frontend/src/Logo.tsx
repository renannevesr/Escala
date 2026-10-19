/** Marca: uma semana de 7 dias — 5 trabalhados (cheios) e 2 de folga (vazados). */
export function LogoMarca({ tamanho = 32 }: { tamanho?: number }) {
  return (
    <svg width={tamanho} height={tamanho} viewBox="0 0 32 32" aria-hidden="true">
      <rect width="32" height="32" rx="8" fill="var(--marca)" />
      <rect x="6" y="7" width="20" height="3" rx="1.5" fill="#fff" opacity="0.9" />
      {[0, 1, 2, 3, 4, 5, 6].map((i) => {
        const x = 6 + (i % 4) * 5.33;
        const y = i < 4 ? 13 : 19.5;
        const folga = i >= 5;
        return (
          <rect
            key={i}
            x={x}
            y={y}
            width="4"
            height="4.5"
            rx="1.2"
            fill={folga ? 'none' : '#fff'}
            stroke={folga ? 'var(--marca-acento)' : 'none'}
            strokeWidth={folga ? 1.3 : 0}
          />
        );
      })}
    </svg>
  );
}

export function Logo({ tamanho = 32 }: { tamanho?: number }) {
  return (
    <span className="logo">
      <LogoMarca tamanho={tamanho} />
      <span className="logo-texto">
        Escala<strong>5x2</strong>
      </span>
    </span>
  );
}
