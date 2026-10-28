---
name: TOCA
description: Actividad y administración de NFC con detalle bajo demanda.
colors:
  ink: "#172b4d"
  paper: "#fff"
  white: "#fff"
  blue: "#2458d3"
  blue-dark: "#1945ab"
  soft-blue: "#edf3ff"
  surface: "#f5f7fa"
  muted: "#586a83"
  line: "#e1e7f0"
  success: "#176344"
  danger: "#a32424"
typography:
  headline:
    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif'
    fontSize: "30px"
    fontWeight: 650
    lineHeight: 1.25
    letterSpacing: "-.025em"
  title:
    fontSize: "21px"
    fontWeight: 650
    lineHeight: 1.25
  body:
    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif'
    fontSize: "14px"
    lineHeight: 1.5
  label:
    fontSize: "12px"
rounded:
  control: "6px"
  navigation: "5px"
  card: "8px"
spacing:
  compact: "8px"
  control-gap: "12px"
  regular: "16px"
  row-gap: "20px"
  section: "24px"
  page: "32px"
components:
  button-primary:
    backgroundColor: "{colors.blue}"
    textColor: "{colors.white}"
    rounded: "{rounded.control}"
    padding: "10px 16px"
  button-primary-hover:
    backgroundColor: "{colors.blue-dark}"
  button-secondary:
    backgroundColor: "{colors.white}"
    textColor: "{colors.blue}"
    rounded: "{rounded.control}"
    padding: "10px 16px"
  text-button:
    textColor: "{colors.blue}"
    padding: "4px 0"
  input:
    backgroundColor: "{colors.white}"
    textColor: "{colors.ink}"
    rounded: "{rounded.control}"
    padding: "10px 12px"
  navigation:
    rounded: "{rounded.navigation}"
    padding: "12px 16px"
  editor-card:
    rounded: "{rounded.card}"
    padding: "24px"
  segmented-control:
    rounded: "{rounded.control}"
    padding: "3px"
  nfc-detail:
    rounded: "{rounded.control}"
    padding: "0 24px 18px"
---

# Design System: TOCA

## Overview

**Creative North Star: "Actividad y NFC"**

TOCA reúne la actividad y la administración de NFC en una superficie blanca, con navegación lateral azul y gris. La lectura parte por las visitas del período y continúa en filas compactas; el destino completo y el historial aparecen al desplegar cada NFC.

El sistema usa tipografía de sistema, separadores y fondos suaves para organizar información. La interfaz prioriza computador y reorganiza la misma web en pantallas pequeñas.

**Key Characteristics:**

- Navegación persistente y actividad antes del listado.
- Un estado visible por NFC y detalles bajo demanda.
- Azul para acciones y selección; profundidad sin sombras decorativas.

Fuente normativa: `app/globals.css`; comportamiento de referencia: `app/panel/page.tsx`, `components/nfc-row.tsx`, `components/traffic-filters.tsx` y `components/traffic-plot.tsx`. Esta documentación describe la implementación del rediseño aprobado el 27 de octubre de 2026.

## Colors

Azul de acción sobre blanco, con tinta azul oscura y superficies grises frías. Los valores exactos están en el frontmatter.

- `blue` identifica acciones, selección y foco; `blue-dark` corresponde al hover del botón principal.
- `paper` y `white` mantienen el fondo general y los controles. `surface` organiza navegación y hover; `soft-blue` acompaña controles secundarios.
- `ink` es el texto principal; `muted`, el texto auxiliar; `line`, los separadores.
- `success` y `danger` se reservan para mensajes de resultado. Activo/Pausado se expresa con texto, sin duplicar el indicador.
- Colores locales observados: selección de navegación `#e4edff`, borde de controles secundarios `#c5d0e0`, borde de campos `#b5c3d6`, fondo del detalle `#f2f6fc`, aviso de error `#fff0ef` y aviso de éxito `#edf8f1`.

## Typography

La familia de sistema se hereda en botones, campos y selectores. H1 usa 30 px/650; H2, 21 px/650; H3, 16 px/600. El cuerpo usa 14 px y altura de línea 1.5. Etiquetas y metadatos usan 12–13 px. El total de visitas usa 22 px; los valores tabulares mantienen alineación numérica.

La marca usa 32 px/750 y espaciado -.035em; su variante lateral usa 28 px. Los títulos principales del panel bajan a 26 px en móvil.

## Layout

La barra lateral fija ocupa 200 px. El contenido deja ese espacio a la izquierda, se centra con ancho máximo de 1500 px y padding 32px 40px 56px. La cuenta se sitúa al pie de la barra lateral.

Orden: título y tres filtros; total y agrupación; gráfico SVG de 220 px; encabezado NFC y listado. Los filtros ocupan hasta 560 px en tres columnas. Las filas usan cinco columnas, separación de 20 px y altura mínima de 80 px. El detalle se abre debajo de su fila.

- Hasta 1200 px: padding horizontal de 28 px, filtros bajo el título, encabezados del listado ocultos y etiquetas en cada dato. Las acciones pasan a una segunda línea.
- Hasta 760 px: navegación horizontal superior, contenido con padding 24px 20px 44px, filtros en dos columnas con período a todo el ancho, agrupación de ancho completo y filas en dos columnas con acciones debajo. El detalle apila destino y edición.
- Formularios: ancho máximo de 760 px, campos con separación de 20 px y acciones alineadas al final. La vista de usuarios pasa de dos columnas a una a 1200 px.

## Elevation & Depth

La profundidad se construye con fondos, bordes de 1 px y separación. No hay sombras decorativas. Menús y ayudas se superponen mediante posición y z-index, manteniendo borde visible y fondo blanco.

El foco usa outline azul de 2 px y offset de 4 px. El spinner gira cada .8 s solo cuando no se solicita reducir movimiento; los cambios de estado no dependen de esa animación.

## Shapes

Controles y detalles usan radio de 6 px; tarjetas y menús, 8 px; navegación, 5 px; botones de agrupación, 4 px. El avatar es circular. La tabla se reconoce por separadores horizontales; cada fila no necesita una tarjeta.

## Components

- **Acciones:** botón principal azul para creación; secundario para edición; enlace de texto para acciones de menor énfasis. Botones generales: altura mínima de 42 px. Campos: 44 px. Copiar: 40 px y ancho de 168 px.
- **Navegación:** Panel para ambos perfiles; Usuarios solo para administrador. La página activa usa `aria-current`. Mi cuenta y Salir se agrupan en el menú de cuenta.
- **Filtros y gráfico:** NFC, destino histórico de la visita y 7/30/90 días afectan gráfico y filas. Total/Por NFC/Por destino cambia la representación. Las visitas son aperturas, no personas únicas; los días corresponden a Chile. El gráfico incluye puntos, leyenda cuando hay varias series, detalle por fecha y tabla desplegable; admite flechas, Inicio y Fin. Con más de seis NFC, agrupa cinco principales y Otros NFC.
- **Fila NFC:** nombre, destino actual resumido, visitas filtradas del período, estado y acciones. Copiar entrega el enlace estable. El menú contiene Editar, Ver historial y Pausar/Activar. El nombre despliega Destino/Historial; el total histórico se mantiene dentro del detalle.
- **Perfiles:** administrador ve propietario, Agregar NFC y Usuarios. El propietario ve sus NFC sin columna de propietario ni creación. Ambos comparten los controles del listado.
- **Estados:** carga de filtros deshabilita controles e informa actualización; historial ofrece carga, vacío, error y Reintentar. Separar ausencia de NFC, selección sin resultados y cero visitas. Los errores de datos se muestran como error, sin sustituirlos por cero. Mensajes de guardado y copia comunican su resultado; configuración pendiente se explica bajo la fila.

## Do's and Don'ts

### Do:

- Usa los tokens de app/globals.css y conserva el foco visible.
- Distingue destino actual, destino histórico de la visita y visitas del período.
- Mantén las acciones de copiar y desplegar disponibles en pantallas pequeñas.

### Don't:

- No dupliques el estado con indicadores adicionales.
- No muestres identificadores técnicos, URL completa ni última visita en la fila compacta.
- No agregues sombras decorativas ni dependencias para reproducir estos componentes.
