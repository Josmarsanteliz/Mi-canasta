import puppeteer from 'puppeteer';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL || 'https://ndpsnygkhnhhkhnzynba.supabase.co';
const supabaseKey = process.env.SUPABASE_ANON_KEY || 'sb_publishable_uuqoYja99iOrICWXypKsRg_3sc0nT-C';
const supabase = createClient(supabaseUrl, supabaseKey);

async function sincronizarPrecios() {
  console.log('🚀 Conectando con Supabase para obtener los productos y sus tiendas...');
  
  // 1. Obtenemos los productos de la tabla principal
  const { data: productos, error } = await supabase.from('productos').select('*');

  if (error || !productos) {
    console.log('❌ Error al obtener los productos:', error);
    return;
  }

  console.log(`📦 Se encontraron ${productos.length} productos registrados.`);
  const browser = await puppeteer.launch({ 
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  for (const producto of productos) {
    console.log(`\n-----------------------------------------`);
    console.log(`🔍 Procesando: ${producto.nombre}`);

    // 2. Obtenemos las URLs registradas para este producto específico en la tabla precios_tiendas
    const { data: tiendasAsociadas, error: errTiendas } = await supabase
      .from('precios_tiendas')
      .select('*')
      .eq('producto_id', producto.id);

    if (errTiendas || !tiendasAsociadas) {
      console.log(`  ❌ No se encontraron tiendas para este producto.`);
      continue;
    }

    for (const itemTienda of tiendasAsociadas) {
      if (!itemTienda.url_producto) continue;

      // Determinamos el selector según la tienda
      let selector = 'span.text-primary'; // Por defecto
      if (itemTienda.tienda.toLowerCase().includes('farmadon')) {
        selector = 'p.price bdi';
      } else if (itemTienda.tienda.toLowerCase().includes('tuzona')) {
        selector = '.prec-area';
      }

      const page = await browser.newPage();
      try {
        await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
        
        await page.goto(itemTienda.url_producto, { waitUntil: 'networkidle2', timeout: 45000 });
        await page.waitForSelector(selector, { timeout: 10000 });

        const precioTexto = await page.$eval(selector, el => el.textContent.trim());
        console.log(`  ✔️ [${itemTienda.tienda}]: ${precioTexto}`);

        // 3. Actualizamos el precio y la fecha en la tabla relacional
        const { error: updateError } = await supabase
          .from('precios_tiendas')
          .update({ 
            precio_texto: precioTexto, 
            updated_at: new Date().toISOString() 
          })
          .eq('id', itemTienda.id);

        if (updateError) {
          console.log(`  ❌ Error al guardar en Supabase:`, updateError.message);
        }

      } catch (err) {
        console.log(`  ❌ [${itemTienda.tienda}]: No se pudo extraer el precio.`);
      } finally {
        await page.close();
      }
    }
  }

  await browser.close();
  console.log('\n✨ ¡Sincronización relacional completada con éxito!');
}

sincronizarPrecios();