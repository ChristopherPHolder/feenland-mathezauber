import { LocaleService } from '../../core/locale';
import { MessageKey } from '../../core/messages';
/** Fill `{name}` placeholders in a localized message, formatting numbers for the locale. */
export function wallText(
  i: LocaleService,
  key: MessageKey,
  params: Record<string, string | number> = {},
): string {
  return Object.entries(params).reduce(
    (text, [name, value]) =>
      text.replaceAll(`{${name}}`, typeof value === 'number' ? i.format(value) : value),
    i.t(key),
  );
}
