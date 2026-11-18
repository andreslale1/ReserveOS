import Reveal from "./reveal";
import WidgetVivo from "./widget-vivo";

export default function HowItWorks() {
  return (
    <section id="formas" className="border-y border-line bg-void-card">
      <div className="mx-auto max-w-6xl px-6 py-24">
        <div className="max-w-2xl">
          <h2 className="text-4xl font-semibold leading-tight text-ink md:text-5xl">Empiezas con lo que ya tienes.</h2>
          <p className="mt-5 text-ink-soft">Tres formas de entrega, un solo sistema por dentro: la misma base de clientes, reservas y pagos.</p>
        </div>

        <div className="mt-14 grid gap-14 md:grid-cols-[1fr_1.15fr] md:items-center">
          <Reveal>
            <h3 className="text-2xl font-semibold text-ink">Si ya tienes página web: un widget.</h3>
            <p className="mt-3 max-w-md leading-relaxed text-ink-soft">Pegas una línea de código y aparece tu horario con sedes, días y paquetes, con tus colores. Quien reserva se registra una sola vez y queda en tu base de datos.</p>
            <pre className="mt-6 overflow-x-auto rounded-xl bg-ink px-5 py-4 text-[13px] leading-relaxed text-void"><code>{`<script src="https://reserveos.app/widget.js"
  data-estudio="tu-gimnasio" async></script>`}</code></pre>
            <p className="mt-3 text-sm text-ink-soft">A la derecha, el widget real funcionando con un estudio de demostración.</p>
          </Reveal>
          <Reveal delay={80}><WidgetVivo /></Reveal>
        </div>

        <div className="mt-20 grid gap-x-14 gap-y-12 border-t border-line pt-14 md:grid-cols-2">
          <Reveal>
            <h3 className="text-2xl font-semibold text-ink">Si solo quieres un link: lo dejamos montado.</h3>
            <p className="mt-3 max-w-md leading-relaxed text-ink-soft">Creamos tu cuenta, cargamos sedes, horarios y paquetes, y damos acceso a tu equipo. Compartes el link por WhatsApp, Instagram o QR.</p>
            <div className="mt-5 flex max-w-md items-center gap-2 rounded-lg border border-line bg-void px-3 py-2.5 text-sm">
              <span className="tabular truncate text-ink">reserveos.app/e/<span className="font-semibold">tu-gimnasio</span></span>
              <span className="ml-auto rounded-md bg-lime px-2.5 py-1 text-xs font-semibold text-white">Copiar</span>
            </div>
          </Reveal>
          <Reveal delay={80}>
            <h3 className="text-2xl font-semibold text-ink">Si no tienes página: la hacemos con tu marca.</h3>
            <p className="mt-3 max-w-md leading-relaxed text-ink-soft">Tomamos tu manual de marca y construimos tu sitio completo con las reservas integradas, en tu propio dominio.</p>
            <a href="/e/atlas-demo" className="press-spring mt-5 inline-flex rounded-lg border border-line bg-void px-4 py-2.5 text-sm font-semibold text-ink hover:border-ink/30">Ver un ejemplo de sitio →</a>
          </Reveal>
        </div>
      </div>
    </section>
  );
}
