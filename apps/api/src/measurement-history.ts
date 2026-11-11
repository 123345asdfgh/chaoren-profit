// Number independent measurements by creation order, before applying search or pagination.
// A revision updates updated_at/version, but must not change the measurement's sequence.
export const rankedMeasurementsSql='SELECT r.*,row_number() OVER (PARTITION BY COALESCE(r.product_id,r.id) ORDER BY r.created_at ASC,r.id ASC)::int AS measurement_sequence FROM profit.records r';
