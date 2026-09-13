import puppeteer from 'puppeteer';
import { createClient } from '@supabase/supabase-js';

// Conexión a tu Supabase
const supabase = createClient('TU_SUPABASE_URL', 'TU_SUPABASE_ANON_KEY');

async function actualizarPreciosTiendas() {
  const browser = await puppeteer.launch({ headless: true });
  const page = await browser.newPage();

  try {
    // 1. Traer todos los registros de precios_tiendas que tienen una URL asignada
    const { data: items, error } = await supabase
      .from('precios_tiendas')
      .select('id, tienda, url_producto');

    if (error) {
      console.error('Error al obtener los enlaces:', error);
      return;
    }

    console.log(`Se encontraron ${items.length} enlaces para rastrear.`);

    // 2. Recorrer cada enlace de forma secuencial
    for (const item of items) {
      if (!item.url_producto) continue;

      console.log(`Scrapeando [${item.tienda}]: ${item.url_producto}`);
      
      try {
        await page.goto(item.url_producto, { waitUntil: 'domcontentloaded', timeout: 30000 });

        let precioTexto = '';

        // 3. Aplicar el selector dependiendo de la tienda
        if (item.tienda === 'Farmadon') {
          // Selector para Farmadon
          precioTexto = await page.$eval('.woocommerce-Price-amount', el => el.innerText).catch(() => null);
        } else if (item.tienda === 'Forum') {
          // Ajusta este selector según la estructura HTML real de Forum
          precioTexto = await page.$eval('.precio-actual', el => el.innerText).catch(() => null);
        }

        if (precioTexto) {
          // 4. Actualizar el precio en Supabase
          const { error: updateError } = await supabase
            .from('precios_tiendas')
            .update({ 
              precio_texto: precioTexto, 
              updated_at: new Date() 
            })
            .eq('id', item.id);

          if (updateError) {
            console.error(`Error al actualizar ID ${item.id}:`, updateError);
          } else {
            console.log(`¡Actualizado con éxito! Precio: ${precioTexto}`);
          }
        } else {
          console.log(`No se pudo encontrar el precio para este enlace.`);
        }

      } catch (err) {
        console.error(`Error al navegar en ${item.url_producto}:`, err.message);
      }
    }

  } catch (err) {
    console.error('Error general en el proceso:', err);
  } finally {
    await browser.close();
    console.log('Proceso de actualización finalizado.');
  }
}

actualizarPreciosTiendas();