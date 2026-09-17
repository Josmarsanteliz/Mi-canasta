import { supabase } from './supabase.js';

const FAVORITOS_TABLE = 'favoritos';
const FAVORITOS_STORAGE_PREFIX = 'micanasta_favoritos_';
const POST_LOGIN_REDIRECT_KEY = 'micanasta_post_login_redirect';

function obtenerStorageFavoritos(userId) {
  return `${FAVORITOS_STORAGE_PREFIX}${userId}`;
}

function leerJsonSeguro(valor) {
  try {
    return JSON.parse(valor);
  } catch {
    return [];
  }
}

export function desglosarPrecioDoble(texto = '') {
  const coincidencias = texto.match(/\d+(?:[.,]\d+)?/g) || [];

  if (coincidencias.length >= 2) {
    return {
      secundario: coincidencias[0],
      principal: coincidencias[1],
      tieneDoblePrecio: true,
    };
  }

  return {
    secundario: '',
    principal: texto,
    tieneDoblePrecio: false,
  };
}

export function leerFavoritosLocales(userId) {
  if (typeof window === 'undefined' || !userId) {
    return [];
  }

  const guardados = window.localStorage.getItem(obtenerStorageFavoritos(userId));
  return guardados ? leerJsonSeguro(guardados) : [];
}

export function guardarFavoritosLocales(userId, favoritos) {
  if (typeof window === 'undefined' || !userId) {
    return;
  }

  window.localStorage.setItem(obtenerStorageFavoritos(userId), JSON.stringify(favoritos));
}

export async function obtenerSesionActual() {
  const { data } = await supabase.auth.getSession();
  return data.session;
}

export async function iniciarSesionConCorreo(email, password) {
  return supabase.auth.signInWithPassword({
    email,
    password,
  });
}

export async function registrarConCorreo(email, password, returnTo = '/') {
  if (typeof window !== 'undefined') {
    window.sessionStorage.setItem(POST_LOGIN_REDIRECT_KEY, returnTo);
  }

  return supabase.auth.signUp({
    email,
    password,
    options: {
      emailRedirectTo: `${window.location.origin}/auth/callback`,
    },
  });
}

export async function cerrarSesion() {
  return supabase.auth.signOut();
}

async function sincronizarFavoritoEnSupabase(session, producto, activo) {
  if (!session?.user) {
    return;
  }

  try {
    if (activo) {
      await supabase.from(FAVORITOS_TABLE).upsert(
        [{
          user_id: session.user.id,
          producto_id: producto.id,
          nombre: producto.nombre,
          imagen_url: producto.imagen_url || null,
          created_at: new Date().toISOString(),
        }],
        { onConflict: 'user_id,producto_id' }
      );
    } else {
      await supabase
        .from(FAVORITOS_TABLE)
        .delete()
        .match({ user_id: session.user.id, producto_id: producto.id });
    }
  } catch (error) {
    console.warn('No se pudo sincronizar favoritos con Supabase:', error);
  }
}

export async function alternarFavoritoProducto(producto) {
  const session = await obtenerSesionActual();

  if (!session?.user) {
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new Event('micanasta-open-auth-login'));
    }

    return { requiereInicioSesion: true, activo: false };
  }

  const userId = session.user.id;
  const favoritos = leerFavoritosLocales(userId);
  const indice = favoritos.findIndex((item) => String(item.id) === String(producto.id));

  let activo = true;

  if (indice >= 0) {
    favoritos.splice(indice, 1);
    activo = false;
  } else {
    favoritos.unshift({
      id: producto.id,
      nombre: producto.nombre,
      imagen: producto.imagen || producto.imagen_url || '',
      creado_en: new Date().toISOString(),
    });
  }

  guardarFavoritosLocales(userId, favoritos);
  await sincronizarFavoritoEnSupabase(session, producto, activo);

  return { requiereInicioSesion: false, activo };
}

export async function obtenerIdsFavoritosActuales() {
  const session = await obtenerSesionActual();

  if (!session?.user) {
    return new Set();
  }

  const favoritos = leerFavoritosLocales(session.user.id);
  return new Set(favoritos.map((item) => String(item.id)));
}

export function obtenerRutaDespuesDeLogin() {
  if (typeof window === 'undefined') {
    return '/';
  }

  return window.sessionStorage.getItem(POST_LOGIN_REDIRECT_KEY) || '/';
}

export function limpiarRutaDespuesDeLogin() {
  if (typeof window === 'undefined') {
    return;
  }

  window.sessionStorage.removeItem(POST_LOGIN_REDIRECT_KEY);
}