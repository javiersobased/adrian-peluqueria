-- Migración: Eliminar citas y registros de clientes de prueba
-- Cuentas: javijunior2018@gmail.com, franciscojavierfarinapadilla@gmail.com, javiersobased@gmail.com

DELETE FROM public.bookings
WHERE lower(trim(email)) IN (
  'javijunior2018@gmail.com',
  'franciscojavierfarinapadilla@gmail.com',
  'javiersobased@gmail.com'
);

DELETE FROM public.customers
WHERE lower(trim(email)) IN (
  'javijunior2018@gmail.com',
  'franciscojavierfarinapadilla@gmail.com',
  'javiersobased@gmail.com'
);
