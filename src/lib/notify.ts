import { sileo } from 'sileo';

interface NotifyOptions {
  description?: string;
  duration?: number;
}

export const notify = {
  success: (title: string, description?: string, options?: Omit<NotifyOptions, 'description'>) => {
    return sileo.success({
      title,
      description,
      duration: options?.duration ?? 4000,
      position: 'top-right',
    });
  },
  error: (title: string, description?: string, options?: Omit<NotifyOptions, 'description'>) => {
    return sileo.error({
      title,
      description,
      duration: options?.duration ?? 5000,
      position: 'top-right',
    });
  },
  warning: (title: string, description?: string, options?: Omit<NotifyOptions, 'description'>) => {
    return sileo.warning({
      title,
      description,
      duration: options?.duration ?? 4000,
      position: 'top-right',
    });
  },
  info: (title: string, description?: string, options?: Omit<NotifyOptions, 'description'>) => {
    return sileo.info({
      title,
      description,
      duration: options?.duration ?? 4000,
      position: 'top-right',
    });
  },
  promise: sileo.promise,
  dismiss: sileo.dismiss,
  clear: sileo.clear,
};
