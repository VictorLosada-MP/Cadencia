"use client";

import { usePathname } from "next/navigation";
import { useEffect } from "react";

const LISTO = "data-visible";

/**
 * Enciende todo lo que lleve la clase `revela` cuando entra en pantalla.
 *
 * Con IntersectionObserver y no con una librería de scroll: son unas líneas, no
 * añade un kilo de JavaScript a una portada, y no ata el producto a que alguien
 * siga manteniendo su paquete.
 *
 * Se marca con un atributo en el DOM en vez de con estado de React: son cien
 * elementos y volver a renderizar el árbol cada vez que uno asoma es pagar
 * mucho por una opacidad.
 */
export function Revela() {
  const donde = usePathname();

  useEffect(() => {
    const encender = (n: Element) => n.setAttribute(LISTO, "si");
    const pendientes = () =>
      Array.from(document.querySelectorAll<HTMLElement>(`.revela:not([${LISTO}])`));

    // Sin observador —o sin ganas de movimiento— se enciende todo de una vez.
    // Es el error que se comete siempre con esto: si la animación es lo que
    // revela el texto, que la animación no corra deja la página en blanco.
    const quieto = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (quieto || typeof IntersectionObserver === "undefined") {
      pendientes().forEach(encender);
      return;
    }

    const ojo = new IntersectionObserver(
      (entradas) => {
        for (const e of entradas) {
          if (!e.isIntersecting) continue;
          encender(e.target);
          // Se revela una sola vez: que un bloque se desvanezca al subir de
          // nuevo hace que la página parezca que se está rompiendo.
          ojo.unobserve(e.target);
        }
      },
      { rootMargin: "0px 0px -12% 0px", threshold: 0.12 },
    );

    const mirar = () => {
      for (const n of pendientes()) {
        // Lo que ya está en pantalla no espera al primer scroll.
        if (n.getBoundingClientRect().top < window.innerHeight) encender(n);
        else ojo.observe(n);
      }
    };

    mirar();

    // Las pantallas de la app se cargan solo en el cliente y los resultados
    // llegan después de una petición: lo que aparece más tarde también tiene
    // que revelarse, o se queda invisible para siempre.
    const cambios = new MutationObserver(() => mirar());
    cambios.observe(document.body, { childList: true, subtree: true });

    return () => {
      ojo.disconnect();
      cambios.disconnect();
    };
    // Al navegar entre rutas el layout no se vuelve a montar, así que el
    // observador se rearma con la ruta.
  }, [donde]);

  return null;
}
