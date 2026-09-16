import { sileo } from 'sileo';

const TOAST_DURATION = 4000;
const DARK_FILL = '#121212';
const AUTOPILOT_EXPAND = { expand: 50, collapse: 3600 };

interface NotifyOptions {
  description?: string;
  duration?: number;
  autopilot?: boolean | { expand?: number; collapse?: number };
}

const buildOptions = (title: string, description?: string, options?: Omit<NotifyOptions, 'description'>) => ({
  title,
  description,
  duration: options?.duration ?? TOAST_DURATION,
  fill: DARK_FILL,
  autopilot: options?.autopilot ?? (description ? AUTOPILOT_EXPAND : false),
  position: 'top-right' as const,
});

export const notify = {
  success: (title: string, description?: string, options?: Omit<NotifyOptions, 'description'>) => {
    return sileo.success(buildOptions(title, description, options));
  },
  error: (title: string, description?: string, options?: Omit<NotifyOptions, 'description'>) => {
    return sileo.error(buildOptions(title, description, options));
  },
  warning: (title: string, description?: string, options?: Omit<NotifyOptions, 'description'>) => {
    return sileo.warning(buildOptions(title, description, options));
  },
  info: (title: string, description?: string, options?: Omit<NotifyOptions, 'description'>) => {
    return sileo.info(buildOptions(title, description, options));
  },
  promise: sileo.promise,
  dismiss: sileo.dismiss,
  clear: sileo.clear,
};

