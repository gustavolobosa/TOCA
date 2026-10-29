import type { Metadata } from "next";
import Image from "next/image";
import type { ReactNode } from "react";

import { PublicFooter, PublicHeader } from "@/components/public-navigation";
import { TrafficPlot } from "@/components/traffic-plot";
import { getWhatsAppUrl } from "@/lib/whatsapp";
import styles from "./page.module.css";

export const metadata: Metadata = {
  title: "TOCA | Conecta tu comercio con un toque",
  description: "Conecta a tus clientes con tus redes, WhatsApp o reseñas de Google. Cambia el destino de tu NFC y consulta sus visitas desde TOCA.",
};

const exampleDates = Array.from({ length: 30 }, (_, index) => `2026-04-${String(index + 1).padStart(2, "0")}`);
const exampleSeries = [
  { id: "caja", label: "Caja", color: "#2458d3", values: [18, 21, 25, 24, 23, 28, 32, 35, 40, 45, 43, 42, 48, 52, 57, 63, 69, 67, 65, 71, 77, 84, 88, 92, 98, 96, 102, 108, 114, 120] },
  { id: "meson", label: "Mesón", color: "#13795b", values: [8, 10, 11, 13, 15, 14, 13, 17, 20, 23, 26, 27, 26, 25, 30, 34, 37, 40, 43, 42, 40, 44, 48, 51, 54, 52, 56, 59, 62, 65] },
];

function OutlineIcon({ children }: { children: ReactNode }) {
  return <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{children}</svg>;
}

function WhatsAppLink({ href }: { href: string }) {
  return <a className={`button button-primary ${styles.contactButton}`} href={href}>
    <OutlineIcon><path d="M21 11.5a9 9 0 0 1-13.3 7.9L3 21l1.6-4.7A9 9 0 1 1 21 11.5Z" /><path d="m8 7 1.5 3-1 1a9 9 0 0 0 4.5 4l1-1.5 3 1.5c-.5 2-2 2-3.5 1.5a12 12 0 0 1-7-7C6 8 6.5 7 8 7Z" /></OutlineIcon>
    Escríbenos por WhatsApp
  </a>;
}

export default function HomePage() {
  const whatsapp = getWhatsAppUrl();

  return <div className={styles.landing}>
    <PublicHeader />
    <main id="contenido">
      <section className={styles.hero} aria-labelledby="presentacion">
        <div className={styles.heroCopy}>
          <h1 id="presentacion">Un toque para conectar. Datos para entender.</h1>
          <p>Tu cliente acerca su celular al soporte NFC y abre el enlace que eliges: tus redes, WhatsApp o reseñas de Google.</p>
          <WhatsAppLink href={whatsapp} />
          <p className={styles.heroNote}>Configurado y listo para tu comercio.</p>
        </div>
        <Image className={styles.heroImage} src="/images/toca-en-uso.png" width={1536} height={1024}
          alt="Una persona selecciona cinco estrellas en una reseña de Google desde su celular, junto al soporte NFC de TOCA."
          sizes="(max-width: 760px) calc(100vw - 40px), (max-width: 1280px) 54vw, 680px"
          loading="eager" fetchPriority="high" />
      </section>
      <section id="como-funciona" className={styles.benefits} aria-label="Cómo funciona TOCA">
        <div className={styles.benefit}>
          <OutlineIcon><rect x="6" y="2" width="12" height="20" rx="2" /><path d="M11 18h2" /></OutlineIcon>
          <div><h2>Sin instalar una app</h2><p>Acerca el celular y abre tu enlace.</p></div>
        </div>
        <div className={styles.benefit}>
          <OutlineIcon><path d="m10 13 4-4M8 15l-1 1a3.5 3.5 0 0 1-5-5l4-4a3.5 3.5 0 0 1 5 0M16 9l1-1a3.5 3.5 0 0 1 5 5l-4 4a3.5 3.5 0 0 1-5 0" /></OutlineIcon>
          <div><h2>Cambia tu enlace</h2><p>Cuando quieras, sin costo extra.</p></div>
        </div>
        <div className={styles.benefit}>
          <OutlineIcon><path d="M5 20v-8M12 20V4M19 20V8" /></OutlineIcon>
          <div><h2>Consulta tus visitas</h2><p>Desde tu panel en TOCA.</p></div>
        </div>
      </section>
      <section className={styles.activity} aria-labelledby="actividad">
        <div className={styles.activityInner}>
          <div className={styles.activityCopy}>
            <h2 id="actividad">Mira las visitas de tu comercio.</h2>
            <p>Consulta las visitas del mes por NFC y destino.</p>
          </div>
          <div className={styles.chart}>
            <div className={styles.chartHeading}><h3>Visitas por día</h3><span>30 días</span></div>
            <TrafficPlot dates={exampleDates} series={exampleSeries} />
            <p className={styles.exampleNote}>Datos de ejemplo: aperturas del enlace.</p>
          </div>
        </div>
      </section>
      <section className={styles.contact} aria-label="Qué incluye TOCA y atención al cliente">
        <div className={styles.serviceDetails}>
          <div>
            <OutlineIcon><path d="m12 2 9 5v10l-9 5-9-5V7l9-5ZM3 7l9 5 9-5M12 12v10M7.5 4.5l9 5" /></OutlineIcon>
            <p>Soporte acrílico, diseño y<br className={styles.desktopBreak} /> configuración inicial incluidos.</p>
          </div>
          <div>
            <OutlineIcon><path d="M4 13v-2a8 8 0 0 1 16 0v2M20 18v1a2 2 0 0 1-2 2h-4" /><rect x="2" y="11" width="4" height="7" rx="2" /><rect x="18" y="11" width="4" height="7" rx="2" /></OutlineIcon>
            <p><strong>Atención al cliente los 7 días de la semana.</strong><br />De 09:00 a 18:00, hora de Chile.<br />Respuestas en menos de 24 horas.</p>
          </div>
        </div>
        <WhatsAppLink href={whatsapp} />
      </section>
    </main>
    <PublicFooter />
  </div>;
}
