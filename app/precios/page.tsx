import type { Metadata } from "next";
import Link from "next/link";
import { plans, pesos } from "@/lib/pricing";
import { checkoutEnabled } from "@/lib/checkout/config";

import { PublicFooter, PublicHeader } from "@/components/public-navigation";
import { getWhatsAppUrl } from "@/lib/whatsapp";
import styles from "./page.module.css";

export const metadata: Metadata = {
  title: "Precios por NFC | TOCA",
  description: `TOCA desde ${pesos(plans.mensual.net)} + IVA al mes por NFC o ${pesos(plans.anual.net)} + IVA al año. Incluye soporte acrílico, configuración inicial y acceso al panel.`,
};

export default function PricingPage() {
  return <div className={styles.page}>
    <PublicHeader current="precios" />
    <main id="contenido" className={styles.main}>
      <div className={styles.intro}>
        <h1>Un precio simple, por NFC.</h1>
        <p>Elige cómo pagar. Ambos planes incluyen lo mismo.</p>
      </div>

      <section className={styles.plans} aria-label="Planes de TOCA">
        {(["mensual", "anual"] as const).map(id => {
          const plan = plans[id];
          return <article key={id} className={`${styles.plan} ${id === "anual" ? styles.annual : ""}`} aria-labelledby={`plan-${id}`}>
            <h2 id={`plan-${id}`}>{plan.name}</h2>
            <p className={styles.price}>{pesos(plan.net)} <span>+ IVA</span></p>
            <p className={styles.period}>por NFC al {plan.period} · {pesos(plan.total)} con IVA</p>
            <p className={styles.billing}>{id === "anual" ? <><strong>2 meses de regalo.</strong> Pagas 10 y usas 12. Cobro anual por adelantado.</> : "Pago mes a mes."}</p>
            {checkoutEnabled() ? <Link className={`button button-primary ${styles.action}`} href={`/comprar?plan=${id}`}>
              Elegir plan {id}
            </Link> : <a className={`button button-primary ${styles.action}`}
              aria-label={`Consultar el plan ${id} por WhatsApp`}
              href={getWhatsAppUrl(`Hola, quiero contratar el plan ${id} de TOCA: ${pesos(plan.net)} + IVA por NFC al ${plan.period}.`)}>
              Consultar por WhatsApp
            </a>}
          </article>;
        })}
      </section>
      <p className={styles.currency}>Precios por NFC en pesos chilenos. Mostramos el precio neto y el total con IVA.</p>

      <section className={styles.included} aria-labelledby="incluye">
        <div>
          <h2 id="incluye">Listo para tu comercio.</h2>
          <ul>
            <li>NFC con soporte acrílico y uno de nuestros diseños disponibles.</li>
            <li>Configuración inicial incluida.</li>
            <li>Acceso al panel para cambiar el enlace y consultar las visitas.</li>
          </ul>
          <p className={styles.sizes}>S: 8 × 8 cm · M: 12 × 12 cm · L: 11 × 14 cm.<br />Elige el tamaño. El precio es el mismo.</p>
        </div>
        <div className={styles.support}>
          <h2>Te acompañamos los 7 días.</h2>
          <p>Atención al cliente los 7 días de la semana,<br className={styles.desktopBreak} /> de 09:00 a 18:00, hora de Chile.</p>
          <p>Respuestas en menos de 24 horas.</p>
        </div>
      </section>
    </main>
    <PublicFooter />
  </div>;
}
