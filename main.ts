/**
 * Respuesta de Metal Archives a upcoming releases
 */
interface LanzamientosTotal {
  iTotalRecords: number;
  iTotalDisplayRecords: number;
  sEcho: number;
  aaData: string[][];
}

/**
 * Tipo validado del que debe notificarse
 */
interface Lanzamiento {
  grupo: string;
  disco: string;
  tipo: string;
  genero: string;
}

/**
 * Dict[str,str], map[string]string, HashMap <String, String>
 */
interface MapaOpciones {
  [clave: string]: string;
}

/**
 * Sleep en milisegundos
 */
function esperar(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * De día en inglés (11th) a número (11),
 */
function diaTextoIngles(fecha: string): string {
  let dia = fecha.replace(/[^0-9]/gm, "");
  if (dia.length == 1) {
    dia = `0${dia}`;
  }
  return dia;
}

/**
 * De fecha inglés string (June 11th, 2024) a AAAA-MM-DD (2024-06-11)
 */
function adaptarFechaAAMMDD(fecha: string): string {
  const relacionMesTexto: MapaOpciones = {
    "january": "01",
    "february": "02",
    "march": "03",
    "april": "04",
    "may": "05",
    "june": "06",
    "july": "07",
    "august": "08",
    "september": "09",
    "october": "10",
    "november": "11",
    "december": "12",
  };

  const mesDiaAño = fecha.split(" ");

  const mes = relacionMesTexto[mesDiaAño[0].trim().toLowerCase()];
  const dia = diaTextoIngles(mesDiaAño[1]);
  const año = mesDiaAño[2].trim();

  return `${año}-${mes}-${dia}`;
}

/**
 * Obtener lanzamientos de Metal Archives y cribar por fecha de hoy
 */
async function recopilarLanzamientos(): Promise<Lanzamiento[]> {
  const lanzamientos: Lanzamiento[] = [];
  const r = await fetch(
    "https://www.metal-archives.com/release/ajax-upcoming/json/",
    {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (X11; Ubuntu; Linux x86_64; rv:126.0) Gecko/20100101 Firefox/126.0",
      },
    },
  );
  if (r.status != 200) {
    enviarMensajeTelegram(
      `ERROR: status code incorrecto ${r.statusText} en la petición a ajax-upcoming/json`,
    );
    return lanzamientos;
  }

  const respuesta: LanzamientosTotal = await r.json();
  if (respuesta.aaData === undefined) {
    enviarMensajeTelegram(
      `ERROR: no se ha devuelto aaData en la petición a ajax-upcoming/json`,
    );
    return lanzamientos;
  }

  const hoy = new Date().toISOString().split("T")[0];
  for (const registro of respuesta.aaData) {
    const grupo = registro[0];
    const disco = registro[1];
    const tipo = registro[2];
    const genero = registro[3];
    const fecha = adaptarFechaAAMMDD(registro[4]);
    if (fecha !== hoy) {
      continue;
    }
    const lanzamiento: Lanzamiento = {
      grupo,
      disco,
      tipo,
      genero,
    };
    lanzamientos.push(lanzamiento);
  }

  return lanzamientos;
}

/**
 * Notificar lanzamientos por Telegram.
 * Mensaje máximo de 4096 caracteres
 */
function notificarLanzamientos(lanzamientos: Lanzamiento[]) {
  if (lanzamientos.length == 0) {
    enviarMensajeTelegram("Sin lanzamientos programados para hoy");
    return;
  }

  let mensajeTelegram = "";

  for (const lanzamiento of lanzamientos) {
    const fragmento =
      `<strong>${lanzamiento.grupo}</strong>: ${lanzamiento.disco} (${lanzamiento.genero}, ${lanzamiento.tipo})\n`;
    if (mensajeTelegram.length + fragmento.length < 4096) {
      mensajeTelegram += fragmento;
      continue;
    }
    enviarMensajeTelegram(mensajeTelegram);
    esperar(2000); // Evitar 429
    mensajeTelegram = fragmento;
  }

  enviarMensajeTelegram(mensajeTelegram);
}

/**
 * Enviar mensaje HTML por Telegram. Variables de entorno necesarias: TG_LANZAMIENTOS_CHAT_ID y TG_BOT_TOKEN
 */
async function enviarMensajeTelegram(mensaje: string) {
  const solicitud = {
    "chat_id": Deno.env.get("TG_LANZAMIENTOS_CHAT_ID"),
    "parse_mode": "html",
    "text": mensaje,
  };

  const r = await fetch(
    `https://api.telegram.org/bot${
      Deno.env.get("TG_BOT_TOKEN")
    }/sendMessage`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(solicitud),
    },
  );
  if (r.status != 200) {
    const error = r.text()
    console.error(`mensaje no enviado ${r.status}: ${error}`)
  }
}

/**
 * Recopilar lanzamientos de hoy en Metal Archives y notificar por Telegram
 */
async function informarLanzamientosDia() {
  const lanzamientos = await recopilarLanzamientos();
  notificarLanzamientos(lanzamientos);
}

informarLanzamientosDia();

