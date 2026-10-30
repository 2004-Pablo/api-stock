// SQLite guarda los timestamps en UTC y date() los agrupa en UTC, pero una
// pyme piensa en su dia local: a las 21:30 en Buenos Aires ya es el dia
// siguiente en UTC. Estas funciones trabajan con el desplazamiento de la zona
// horaria de la empresa para que la ventana consultada y los dias agrupados
// usen siempre el mismo calendario.

// Minutos de diferencia respecto de UTC en esa zona y ese instante
// (Buenos Aires -> -180). Una zona invalida cae en UTC en lugar de romper.
export function tzOffsetMinutes(timeZone, at = new Date()) {
  try {
    const formatter = new Intl.DateTimeFormat('en-US', {
      timeZone,
      hour12: false,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
    const parts = {};
    for (const part of formatter.formatToParts(at)) {
      if (part.type !== 'literal') parts[part.type] = Number(part.value);
    }
    const wallClockAsUtc = Date.UTC(
      parts.year,
      parts.month - 1,
      parts.day,
      parts.hour === 24 ? 0 : parts.hour,
      parts.minute,
      parts.second,
    );
    return Math.round((wallClockAsUtc - at.getTime()) / 60_000);
  } catch {
    return 0;
  }
}

// Modificador que entiende SQLite: date(createdAt, '-03:00').
export function sqliteTzModifier(offsetMinutes) {
  const sign = offsetMinutes < 0 ? '-' : '+';
  const abs = Math.abs(offsetMinutes);
  const hours = String(Math.floor(abs / 60)).padStart(2, '0');
  const minutes = String(abs % 60).padStart(2, '0');
  return `${sign}${hours}:${minutes}`;
}

// Componentes del dia local (year, month, day) en esa zona.
function localParts(offsetMinutes, at) {
  const shifted = new Date(at.getTime() + offsetMinutes * 60_000);
  return {
    year: shifted.getUTCFullYear(),
    month: shifted.getUTCMonth(),
    day: shifted.getUTCDate(),
  };
}

// Instante UTC de la medianoche local de hace (days - 1) dias.
// days = 1 devuelve la medianoche de hoy.
export function startOfLocalDaysAgo(days, offsetMinutes, at = new Date()) {
  const { year, month, day } = localParts(offsetMinutes, at);
  const midnight = Date.UTC(year, month, day - (days - 1), 0, 0, 0, 0);
  return new Date(midnight - offsetMinutes * 60_000);
}

// Claves "YYYY-MM-DD" de los ultimos `days` dias locales, de la mas vieja a hoy.
export function localDayKeys(days, offsetMinutes, at = new Date()) {
  const { year, month, day } = localParts(offsetMinutes, at);
  const keys = [];
  for (let index = days - 1; index >= 0; index -= 1) {
    keys.push(new Date(Date.UTC(year, month, day - index)).toISOString().slice(0, 10));
  }
  return keys;
}
