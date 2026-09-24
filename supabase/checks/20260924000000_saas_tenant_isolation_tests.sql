-- Tests de aislamiento multi-tenant (Paso 4, actualizados en los pasos 8 y del motor de temas). No persiste nada: los datos de prueba
-- se crean en una subtransacción que siempre se deshace. Devuelve una fila por test.
-- Con SET app.tenant_tests_strict = 'on' aborta la transacción si algún test falla.

CREATE TEMP TABLE IF NOT EXISTS tenant_isolation_results (n serial, test text, ok boolean, detail text) ON COMMIT DROP;

DO $tests$
DECLARE
  v_a uuid := 'f67af497-5e58-48a2-8bea-022c4f1d7e1a';
  v_b uuid := gen_random_uuid();
  v_c uuid := gen_random_uuid();
  v_admin_a text := 'adrian.millan.peguero@hotmail.com';
  v_barber_a text := '19lorenvazquez@gmail.com';
  v_admin_b text := 'admin-b@tenant-test.invalid';
  v_platform text := 'franciscojavierfarinapadilla@gmail.com';
  v_customer uuid;
  v_booking_a uuid;
  v_booking_b uuid;
  v_service_a text;
  v_price_a integer;
  v_n bigint;
  v_n2 bigint;
  v_j jsonb;
  v_t text;
  v_ok boolean;
  r_test text[] := '{}';
  r_ok boolean[] := '{}';
  r_detail text[] := '{}';
BEGIN
  BEGIN
    -- ── Datos de prueba ──
    INSERT INTO public.businesses (id, slug, name, status) VALUES
      (v_b, 'tenant-test-b-' || substr(v_b::text, 1, 8), 'Tenant Test B', 'active'),
      (v_c, 'tenant-test-c-' || substr(v_c::text, 1, 8), 'Tenant Test C', 'draft');
    INSERT INTO public.barbers (business_id, id, name, role, initials, active) VALUES
      (v_b, 'tt-barber-b', 'Barber B', 'Barbero', 'BB', true),
      (v_c, 'tt-barber-c', 'Barber C', 'Barbero', 'BC', true);
    INSERT INTO public.staff (business_id, email, full_name, role, barber_id, status)
      VALUES (v_b, v_admin_b, 'Admin B', 'admin', NULL, 'verified');
    INSERT INTO public.services (business_id, name, price, duration, duration_minutes)
      VALUES (v_b, 'Corte B', 10, '30min', 30);
    INSERT INTO public.bookings (business_id, service, service_price, barber, booking_date, booking_time, full_name, phone, status)
      VALUES (v_b, 'Corte B', 10, 'tt-barber-b', current_date + 5, '10:00', 'Cliente B', '+34611223344', 'confirmed')
      RETURNING id INTO v_booking_b;

    SELECT id INTO v_booking_a FROM public.bookings WHERE business_id = v_a ORDER BY created_at DESC LIMIT 1;
    SELECT name, price INTO v_service_a, v_price_a FROM public.services WHERE business_id = v_a AND active ORDER BY sort_order LIMIT 1;
    SELECT c.user_id INTO v_customer FROM public.customers c
    WHERE c.business_id = v_a
      AND NOT EXISTS (SELECT 1 FROM public.bookings b WHERE b.user_id = c.user_id AND b.status <> 'cancelled' AND b.booking_date >= current_date)
    ORDER BY c.created_at LIMIT 1;

    -- ── T1: admin del negocio A ──
    PERFORM set_config('request.jwt.claims', json_build_object('sub', gen_random_uuid(), 'email', v_admin_a, 'role', 'authenticated')::text, true);
    SET LOCAL ROLE authenticated;

    SELECT count(*) INTO v_n FROM public.bookings WHERE business_id = v_b;
    r_test := r_test || text 'A-admin no ve reservas de B'; r_ok := r_ok || (v_n = 0); r_detail := r_detail || v_n::text;
    SELECT count(*) INTO v_n FROM public.bookings WHERE business_id = v_a;
    r_test := r_test || text 'A-admin ve reservas de A'; r_ok := r_ok || (v_n > 0); r_detail := r_detail || v_n::text;
    SELECT count(*) INTO v_n FROM public.staff WHERE business_id = v_b;
    r_test := r_test || text 'A-admin no ve staff de B'; r_ok := r_ok || (v_n = 0); r_detail := r_detail || v_n::text;
    SELECT count(*) INTO v_n FROM public.booking_notifications WHERE business_id = v_b;
    r_test := r_test || text 'A-admin no ve notificaciones de B'; r_ok := r_ok || (v_n = 0); r_detail := r_detail || v_n::text;
    UPDATE public.bookings SET comments = comments WHERE id = v_booking_b;
    GET DIAGNOSTICS v_n = ROW_COUNT;
    r_test := r_test || text 'A-admin no modifica reserva de B'; r_ok := r_ok || (v_n = 0); r_detail := r_detail || v_n::text;
    v_j := public.get_my_role(v_a);
    r_test := r_test || text 'A-admin get_my_role(A) = admin'; r_ok := r_ok || (v_j->>'role' = 'admin'); r_detail := r_detail || v_j::text;
    r_test := r_test || text 'A-admin escribe en raíz de Storage (legacy)';
    r_ok := r_ok || public.can_write_storage_object('legacy.png', ARRAY['admin']); r_detail := r_detail || text '';
    r_test := r_test || text 'A-admin no escribe en carpeta de B';
    r_ok := r_ok || NOT public.can_write_storage_object('businesses/' || v_b || '/x.png', ARRAY['admin']); r_detail := r_detail || text '';
    RESET ROLE;

    -- ── T2: admin del negocio B ──
    PERFORM set_config('request.jwt.claims', json_build_object('sub', gen_random_uuid(), 'email', v_admin_b, 'role', 'authenticated')::text, true);
    SET LOCAL ROLE authenticated;

    SELECT count(*) FILTER (WHERE business_id <> v_b), count(*) INTO v_n, v_n2 FROM public.bookings;
    r_test := r_test || text 'B-admin solo ve reservas de B'; r_ok := r_ok || (v_n = 0 AND v_n2 = 1); r_detail := r_detail || (v_n || ' ajenas / ' || v_n2 || ' total');
    SELECT count(*) INTO v_n FROM public.customers WHERE business_id = v_a;
    r_test := r_test || text 'B-admin no ve clientes de A'; r_ok := r_ok || (v_n = 0); r_detail := r_detail || v_n::text;
    SELECT count(*) INTO v_n FROM public.staff WHERE business_id = v_a;
    r_test := r_test || text 'B-admin no ve staff de A'; r_ok := r_ok || (v_n = 0); r_detail := r_detail || v_n::text;
    SELECT count(*) INTO v_n FROM public.booking_notifications WHERE business_id = v_a;
    r_test := r_test || text 'B-admin no ve notificaciones de A'; r_ok := r_ok || (v_n = 0); r_detail := r_detail || v_n::text;
    UPDATE public.bookings SET status = 'cancelled' WHERE business_id = v_a;
    GET DIAGNOSTICS v_n = ROW_COUNT;
    r_test := r_test || text 'B-admin no cancela reservas de A'; r_ok := r_ok || (v_n = 0); r_detail := r_detail || v_n::text;
    DELETE FROM public.bookings WHERE business_id = v_a;
    GET DIAGNOSTICS v_n = ROW_COUNT;
    r_test := r_test || text 'B-admin no borra reservas de A'; r_ok := r_ok || (v_n = 0); r_detail := r_detail || v_n::text;
    UPDATE public.services SET price = price WHERE business_id = v_a;
    GET DIAGNOSTICS v_n = ROW_COUNT;
    r_test := r_test || text 'B-admin no modifica servicios de A'; r_ok := r_ok || (v_n = 0); r_detail := r_detail || v_n::text;

    BEGIN
      INSERT INTO public.bookings (business_id, service, service_price, barber, booking_date, booking_time, full_name, phone)
        VALUES (v_a, 'X', 0, 'adrian', current_date + 7, '11:00', 'Intruso', '+34622334455');
      v_ok := false; v_t := 'insertó';
    EXCEPTION WHEN OTHERS THEN v_ok := true; v_t := SQLERRM; END;
    r_test := r_test || text 'B-admin no crea reservas en A'; r_ok := r_ok || v_ok; r_detail := r_detail || v_t;

    BEGIN
      INSERT INTO public.barbers (business_id, id, name, role, initials) VALUES (v_a, 'tt-intruso', 'I', 'B', 'I');
      v_ok := false; v_t := 'insertó';
    EXCEPTION WHEN OTHERS THEN v_ok := true; v_t := SQLERRM; END;
    r_test := r_test || text 'B-admin no crea barberos en A'; r_ok := r_ok || v_ok; r_detail := r_detail || v_t;

    BEGIN
      INSERT INTO public.staff (business_id, email, role, status) VALUES (v_a, 'intruso@tenant-test.invalid', 'admin', 'verified');
      v_ok := false; v_t := 'insertó';
    EXCEPTION WHEN OTHERS THEN v_ok := true; v_t := SQLERRM; END;
    r_test := r_test || text 'B-admin no se da de alta como admin de A'; r_ok := r_ok || v_ok; r_detail := r_detail || v_t;

    BEGIN
      PERFORM public.update_my_barber_profile('adrian', 'Hack', NULL);
      v_ok := false; v_t := 'actualizó';
    EXCEPTION WHEN OTHERS THEN v_ok := true; v_t := SQLERRM; END;
    r_test := r_test || text 'B-admin no edita perfil de A vía RPC'; r_ok := r_ok || v_ok; r_detail := r_detail || v_t;

    v_j := public.get_my_role(v_a);
    r_test := r_test || text 'B-admin get_my_role(A) = sin rol'; r_ok := r_ok || (v_j->>'role' IS NULL); r_detail := r_detail || v_j::text;
    v_j := public.get_my_role(v_b);
    r_test := r_test || text 'B-admin get_my_role(B) = admin'; r_ok := r_ok || (v_j->>'role' = 'admin'); r_detail := r_detail || v_j::text;
    r_test := r_test || text 'B-admin no es admin de A'; r_ok := r_ok || NOT public.has_business_role(v_a, ARRAY['admin']); r_detail := r_detail || text '';

    BEGIN
      UPDATE public.staff SET role = 'barber', is_owner = false WHERE business_id = v_b AND email = v_platform;
      v_ok := false; v_t := 'degradó a la plataforma';
    EXCEPTION WHEN OTHERS THEN v_ok := true; v_t := SQLERRM; END;
    r_test := r_test || text 'B-admin no degrada a la plataforma'; r_ok := r_ok || v_ok; r_detail := r_detail || v_t;

    BEGIN
      PERFORM public.platform_grant_business_admin(v_a, 'intruso@tenant-test.invalid');
      v_ok := false; v_t := 'dio de alta un admin';
    EXCEPTION WHEN OTHERS THEN v_ok := true; v_t := SQLERRM; END;
    r_test := r_test || text 'B-admin no usa el onboarding de plataforma'; r_ok := r_ok || v_ok; r_detail := r_detail || v_t;
    r_test := r_test || text 'B-admin escribe en su carpeta de Storage';
    r_ok := r_ok || public.can_write_storage_object('businesses/' || v_b || '/x.png', ARRAY['admin']); r_detail := r_detail || text '';
    r_test := r_test || text 'B-admin no escribe en carpeta de A';
    r_ok := r_ok || NOT public.can_write_storage_object('businesses/' || v_a || '/x.png', ARRAY['admin']); r_detail := r_detail || text '';
    r_test := r_test || text 'B-admin no escribe en raíz legacy de Storage';
    r_ok := r_ok || NOT public.can_write_storage_object('legacy.png', ARRAY['admin']); r_detail := r_detail || text '';
    RESET ROLE;

    -- ── T3: barbero de A (solo su agenda) ──
    PERFORM set_config('request.jwt.claims', json_build_object('sub', gen_random_uuid(), 'email', v_barber_a, 'role', 'authenticated')::text, true);
    SET LOCAL ROLE authenticated;

    SELECT count(*) INTO v_n FROM public.bookings WHERE barber <> 'loren';
    r_test := r_test || text 'Barbero solo ve sus citas'; r_ok := r_ok || (v_n = 0); r_detail := r_detail || v_n::text;
    SELECT count(*) INTO v_n FROM public.booking_notifications WHERE barber <> 'loren';
    r_test := r_test || text 'Barbero solo ve sus notificaciones'; r_ok := r_ok || (v_n = 0); r_detail := r_detail || v_n::text;
    UPDATE public.barber_blocks SET note = note WHERE barber = 'adrian';
    GET DIAGNOSTICS v_n = ROW_COUNT;
    r_test := r_test || text 'Barbero no modifica bloqueos de otro'; r_ok := r_ok || (v_n = 0); r_detail := r_detail || v_n::text;

    BEGIN
      UPDATE public.barbers SET google_email = 'otro@tenant-test.invalid' WHERE id = 'loren';
      v_ok := false; v_t := 'actualizó';
    EXCEPTION WHEN OTHERS THEN v_ok := true; v_t := SQLERRM; END;
    r_test := r_test || text 'Barbero no cambia su email de acceso'; r_ok := r_ok || v_ok; r_detail := r_detail || v_t;

    UPDATE public.barbers SET name = name WHERE id = 'loren';
    GET DIAGNOSTICS v_n = ROW_COUNT;
    r_test := r_test || text 'Barbero edita su propio perfil'; r_ok := r_ok || (v_n = 1); r_detail := r_detail || v_n::text;

    BEGIN
      PERFORM public.update_my_barber_profile('adrian', 'Hack', NULL);
      v_ok := false; v_t := 'actualizó';
    EXCEPTION WHEN OTHERS THEN v_ok := true; v_t := SQLERRM; END;
    r_test := r_test || text 'Barbero no edita perfil ajeno vía RPC'; r_ok := r_ok || v_ok; r_detail := r_detail || v_t;

    v_j := public.get_my_role(v_a);
    r_test := r_test || text 'Barbero get_my_role(A) = barber/loren';
    r_ok := r_ok || (v_j->>'role' = 'barber' AND v_j->>'barber_id' = 'loren'); r_detail := r_detail || v_j::text;
    RESET ROLE;

    -- ── T4: anónimo ──
    PERFORM set_config('request.jwt.claims', '{"role":"anon"}', true);
    SET LOCAL ROLE anon;

    SELECT count(*) INTO v_n FROM public.barbers WHERE business_id = v_b;
    r_test := r_test || text 'Anon ve catálogo de negocio activo'; r_ok := r_ok || (v_n = 1); r_detail := r_detail || v_n::text;
    SELECT count(*) INTO v_n FROM public.barbers WHERE business_id = v_c;
    r_test := r_test || text 'Anon no ve negocio en borrador'; r_ok := r_ok || (v_n = 0); r_detail := r_detail || v_n::text;

    BEGIN
      SELECT google_email INTO v_t FROM public.barbers LIMIT 1;
      v_ok := false; v_t := 'leyó google_email';
    EXCEPTION WHEN OTHERS THEN v_ok := true; v_t := SQLERRM; END;
    r_test := r_test || text 'Anon no lee emails del equipo'; r_ok := r_ok || v_ok; r_detail := r_detail || v_t;

    BEGIN
      SELECT count(*) INTO v_n FROM public.business_domains;
      v_ok := false; v_t := v_n::text;
    EXCEPTION WHEN OTHERS THEN v_ok := true; v_t := SQLERRM; END;
    r_test := r_test || text 'Anon no lee business_domains'; r_ok := r_ok || v_ok; r_detail := r_detail || v_t;

    BEGIN
      SELECT count(*) INTO v_n FROM public.bookings;
      v_ok := (v_n = 0); v_t := v_n::text;
    EXCEPTION WHEN OTHERS THEN v_ok := true; v_t := SQLERRM; END;
    r_test := r_test || text 'Anon no lee reservas'; r_ok := r_ok || v_ok; r_detail := r_detail || v_t;

    v_j := public.get_booked_intervals('tt-barber-b', current_date + 5, v_b);
    r_test := r_test || text 'Disponibilidad de B muestra su hueco'; r_ok := r_ok || (jsonb_array_length(v_j) = 1); r_detail := r_detail || v_j::text;
    v_j := public.get_booked_intervals('tt-barber-b', current_date + 5);
    r_test := r_test || text 'Disponibilidad sin negocio vacía'; r_ok := r_ok || (jsonb_array_length(v_j) = 0); r_detail := r_detail || v_j::text;
    v_j := public.get_booked_intervals('tt-barber-c', current_date + 5, v_c);
    r_test := r_test || text 'Disponibilidad de negocio en borrador vacía'; r_ok := r_ok || (jsonb_array_length(v_j) = 0); r_detail := r_detail || v_j::text;
    SELECT count(*) INTO v_n FROM public.store_products WHERE business_id = v_b;
    r_test := r_test || text 'Anon no ve tienda de un plan sin has_store'; r_ok := r_ok || (v_n = 0); r_detail := r_detail || v_n::text;
    SELECT count(*) INTO v_n FROM public.layout_variants;
    r_test := r_test || text 'Anon lee el catálogo de variantes'; r_ok := r_ok || (v_n = 20); r_detail := r_detail || v_n::text;
    BEGIN
      SELECT count(*) INTO v_n FROM public.plans;
      v_ok := false; v_t := v_n::text;
    EXCEPTION WHEN OTHERS THEN v_ok := true; v_t := SQLERRM; END;
    r_test := r_test || text 'Anon no lee planes'; r_ok := r_ok || v_ok; r_detail := r_detail || v_t;
    RESET ROLE;

    -- ── T5: cliente autenticado ──
    IF v_customer IS NULL THEN
      r_test := r_test || text 'Cliente disponible para pruebas'; r_ok := r_ok || false; r_detail := r_detail || text 'sin cliente libre en A';
    ELSE
      PERFORM set_config('request.jwt.claims', json_build_object('sub', v_customer, 'email', 'tenant-test-customer@example.invalid', 'role', 'authenticated')::text, true);
      SET LOCAL ROLE authenticated;

      v_j := public.create_booking('Corte B', 10, 'tt-barber-b', current_date + 6, '12:00', 'Cliente Test', '+34633445566', '', v_b);
      r_test := r_test || text 'create_booking en B queda en B'; r_ok := r_ok || ((v_j->>'business_id')::uuid = v_b); r_detail := r_detail || (v_j->>'business_id');

      BEGIN
        PERFORM public.create_booking('Corte B', 10, 'adrian', current_date + 6, '13:00', 'Cliente Test', '+34633445566', '', v_b);
        v_ok := false; v_t := 'reservó';
      EXCEPTION WHEN OTHERS THEN v_ok := true; v_t := SQLERRM; END;
      r_test := r_test || text 'create_booking rechaza barbero de otro negocio'; r_ok := r_ok || v_ok; r_detail := r_detail || v_t;

      BEGIN
        PERFORM public.create_booking('Corte C', 10, 'tt-barber-c', current_date + 6, '14:00', 'Cliente Test', '+34633445566', '', v_c);
        v_ok := false; v_t := 'reservó';
      EXCEPTION WHEN OTHERS THEN v_ok := true; v_t := SQLERRM; END;
      r_test := r_test || text 'create_booking rechaza negocio en borrador'; r_ok := r_ok || v_ok; r_detail := r_detail || v_t;

      BEGIN
        PERFORM public.create_booking(v_service_a, v_price_a, 'adrian', current_date + 50, '10:10', 'Cliente Test', '+34633445566');
        v_ok := false; v_t := 'reservó sin negocio';
      EXCEPTION WHEN OTHERS THEN v_ok := (SQLERRM = 'Falta el negocio de la reserva'); v_t := SQLERRM; END;
      r_test := r_test || text 'create_booking sin negocio rechazado'; r_ok := r_ok || v_ok; r_detail := r_detail || v_t;

      v_j := public.create_booking(v_service_a, v_price_a, 'adrian', current_date + 50, '10:10', 'Cliente Test', '+34633445566', '', v_a);
      r_test := r_test || text 'create_booking en A queda en A'; r_ok := r_ok || ((v_j->>'business_id')::uuid = v_a); r_detail := r_detail || (v_j->>'business_id');

      SELECT count(*) INTO v_n FROM public.bookings WHERE user_id IS DISTINCT FROM v_customer;
      r_test := r_test || text 'Cliente no ve reservas ajenas'; r_ok := r_ok || (v_n = 0); r_detail := r_detail || v_n::text;
      SELECT count(*) INTO v_n FROM public.bookings WHERE user_id = v_customer;
      r_test := r_test || text 'Cliente ve sus reservas de ambos negocios'; r_ok := r_ok || (v_n >= 2); r_detail := r_detail || v_n::text;
      RESET ROLE;
    END IF;

    -- ── T6: integridad en base de datos ──
    BEGIN
      UPDATE public.bookings SET business_id = v_b WHERE id = v_booking_a;
      v_ok := false; v_t := 'movió la reserva';
    EXCEPTION WHEN OTHERS THEN v_ok := true; v_t := SQLERRM; END;
    r_test := r_test || text 'business_id inmutable'; r_ok := r_ok || v_ok; r_detail := r_detail || v_t;

    BEGIN
      INSERT INTO public.barber_blocks (business_id, barber, block_type, block_date) VALUES (v_b, 'adrian', 'day_off', current_date + 3);
      v_ok := false; v_t := 'insertó';
    EXCEPTION WHEN OTHERS THEN v_ok := true; v_t := SQLERRM; END;
    r_test := r_test || text 'Bloqueo con barbero de otro negocio rechazado'; r_ok := r_ok || v_ok; r_detail := r_detail || v_t;

    BEGIN
      INSERT INTO public.bookings (business_id, service, service_price, barber, booking_date, booking_time, full_name, phone)
        VALUES (v_b, 'Corte B', 10, 'adrian', current_date + 8, '10:00', 'Cruce', '+34644556677');
      v_ok := false; v_t := 'insertó';
    EXCEPTION WHEN OTHERS THEN v_ok := true; v_t := SQLERRM; END;
    r_test := r_test || text 'Reserva con barbero de otro negocio rechazada'; r_ok := r_ok || v_ok; r_detail := r_detail || v_t;

    INSERT INTO public.booking_notifications (booking_id, type, title, message, client_name, barber)
      VALUES (v_booking_b, 'created', 't', 'm', 'c', 'tt-barber-b')
      RETURNING business_id::text INTO v_t;
    r_test := r_test || text 'Notificación hereda el negocio de su reserva'; r_ok := r_ok || (v_t = v_b::text); r_detail := r_detail || v_t;

    SELECT count(*) INTO v_n FROM public.staff WHERE business_id = v_b AND email = v_platform AND role = 'admin' AND is_owner;
    r_test := r_test || text 'Negocio nuevo incluye a la plataforma como titular'; r_ok := r_ok || (v_n = 1); r_detail := r_detail || v_n::text;
    SELECT plan_code || ' ' || (active_features->>'has_store') INTO v_t FROM public.businesses WHERE id = v_b;
    r_test := r_test || text 'Negocio nuevo nace en plan basic sin tienda'; r_ok := r_ok || (v_t = 'basic false'); r_detail := r_detail || v_t;

    RAISE EXCEPTION 'TENANT_TESTS_ROLLBACK';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM <> 'TENANT_TESTS_ROLLBACK' THEN
      r_test := r_test || text 'ejecución'; r_ok := r_ok || false; r_detail := r_detail || SQLERRM;
    END IF;
  END;

  RESET ROLE;
  INSERT INTO tenant_isolation_results (test, ok, detail)
  SELECT t, o, d FROM unnest(r_test, r_ok, r_detail) AS u(t, o, d);

  IF coalesce(current_setting('app.tenant_tests_strict', true), '') = 'on' AND false = ANY (r_ok) THEN
    RAISE EXCEPTION 'Tests de aislamiento fallidos: %',
      (SELECT string_agg(t || ' → ' || d, ' | ') FROM unnest(r_test, r_ok, r_detail) AS u(t, o, d) WHERE NOT o);
  END IF;
END $tests$;

SELECT n, test, ok, left(detail, 140) AS detail FROM tenant_isolation_results ORDER BY n;
