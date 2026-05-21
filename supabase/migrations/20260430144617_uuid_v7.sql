-- Implementation of UUID v7 for PostgreSQL
-- Based on IETF draft (time-ordered UUIDs)

CREATE OR REPLACE FUNCTION public.uuid_generate_v7()
RETURNS uuid
AS $$
DECLARE
    v_time timestamp with time zone := null;
    v_secs bigint := null;
    v_msec bigint := null;
    v_usec bigint := null;
    v_timestamp bigint := null;
    v_timestamp_hex varchar := null;
    v_random bytea := null;
    v_random_hex varchar := null;
    v_bytes bytea;
BEGIN
    v_time := clock_timestamp();
    v_secs := EXTRACT(EPOCH FROM v_time);
    v_msec := mod(EXTRACT(MILLISECONDS FROM v_time)::numeric, 1000::numeric)::bigint;
    v_usec := mod(EXTRACT(MICROSECONDS FROM v_time)::numeric, 1000::numeric)::bigint;

    v_timestamp := (v_secs * 1000) + v_msec;
    v_timestamp_hex := lpad(to_hex(v_timestamp), 12, '0');
    v_random := gen_random_bytes(10);
    v_random_hex := encode(v_random, 'hex');

    v_random_hex := substr(v_random_hex, 1, 3) || substr(v_random_hex, 5, 3) || substr(v_random_hex, 9, 4) || substr(v_random_hex, 13, 10);

    RETURN (v_timestamp_hex || '7' || substr(v_random_hex, 1, 3) || 'a' || substr(v_random_hex, 4, 15))::uuid;
END;
$$ LANGUAGE plpgsql VOLATILE;
