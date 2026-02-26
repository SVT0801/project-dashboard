/**
 * Utility functions for Project Dashboard extension
 */

/**
 * Sanitize color value to prevent XSS injection
 * @param color Color string to validate
 * @returns Valid hex color or default gray
 */
export function sanitizeColor(color: string): string {
  // Validate hex color format
  if (/^#[0-9A-Fa-f]{6}$/.test(color)) {
    return color;
  }
  // Return default color if invalid
  return '#808080';
}

/**
 * Escape HTML special characters to prevent XSS
 * @param text Text to escape
 * @returns Escaped text safe for HTML insertion
 */
export function escapeHtml(text: string): string {
  const map: { [key: string]: string } = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#039;'
  };
  return text.replace(/[&<>"']/g, (m) => map[m]);
}

/**
 * Create a debounced version of a function
 * @param func Function to debounce
 * @param wait Delay in milliseconds
 * @returns Debounced function
 */
export function debounce<T extends (...args: any[]) => any>(
  func: T,
  wait: number
): (...args: Parameters<T>) => void {
  let timeout: NodeJS.Timeout | undefined;
  return function(...args: Parameters<T>) {
    if (timeout) {
      clearTimeout(timeout);
    }
    timeout = setTimeout(() => func(...args), wait);
  };
}

/**
 * Format date to localized string
 * @param dateString ISO date string
 * @returns Formatted date string
 */
export function formatDate(dateString: string): string {
  const date = new Date(dateString);
  return date.toLocaleString('ru-RU', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
}

/**
 * Generate unique ID
 * @returns Unique identifier string
 */
export function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}
