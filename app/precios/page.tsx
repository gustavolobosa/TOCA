import type { Metadata } from "next";

import { PublicFooter, PublicHeader } from "@/components/public-navigation";
import { getWhatsAppUrl } from "@/lib/whatsapp";
import styles from "./page.module.css";

export const metadata: Metadata = {
  title: "Precios por NFC | TOCA",
  description: "TOCA desde $1.300 + IVA al mes por NFC o $13.000 + IVA al año. Incluye soporte acrílico, diseño disponible, configuración inicial y acceso al panel.",
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
        <article className={styles.plan} aria-labelledby="plan-mensual">
          <h2 id="plan-mensual">Plan mensual</h2>
          <p className={styles.price}>$1.300 <span>+ IVA</span></p>
          <p className={styles.period}>por NFC al mes</p>
          <p className={styles.billing}>Pago mes a mes.</p>
          <a className={`button button-primary ${styles.action}`}
            aria-label="Consultar el plan mensual por WhatsApp"
            href={getWhatsAppUrl("Hola, quiero contratar el plan mensual de TOCA: $1.300 + IVA por NFC al mes.")}>
            Consultar por WhatsApp
          </a>
        </article>

        <article className={`${styles.plan} ${styles.annual}`} aria-labelledby="plan-anual">
          <h2 id="plan-anual">Plan anual</h2>
          <p className={styles.price}>$13.000 <span>+ IVA</span></p>
          <p className={styles.period}>por NFC al año · un solo pago</p>
          <p className={styles.billing}><strong>2 meses de regalo.</strong> Pagas 10 y usas 12.</p>
          <a className={`button button-primary ${styles.action}`}
            aria-label="Consultar el plan anual por WhatsApp"
            href={getWhatsAppUrl("Hola, quiero contratar el plan anual de TOCA: $13.000 + IVA por NFC al año, en un solo pago.")}>
            Consultar por WhatsApp
          </a>
        </article>
      </section>
      <p className={styles.currency}>Precios en pesos chilenos. IVA no incluido.</p>

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
