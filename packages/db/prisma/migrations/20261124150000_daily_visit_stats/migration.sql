-- CreateTable
CREATE TABLE "daily_visit_stats" (
    "id" UUID NOT NULL,
    "day" DATE NOT NULL,
    "org_unit_id" UUID,
    "user_id" UUID NOT NULL,
    "place_kind" "check_in_place_kind" NOT NULL,
    "province_name" TEXT,
    "visits" INTEGER NOT NULL,
    "flagged" INTEGER NOT NULL,
    "road_km" DOUBLE PRECISION NOT NULL,
    "road_visits" INTEGER NOT NULL,
    "gps_km" DOUBLE PRECISION NOT NULL,
    "gps_visits" INTEGER NOT NULL,
    "computed_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "daily_visit_stats_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "daily_visit_stats_day_idx" ON "daily_visit_stats"("day");

-- CreateIndex
CREATE INDEX "daily_visit_stats_user_id_day_idx" ON "daily_visit_stats"("user_id", "day");

-- CreateIndex
CREATE INDEX "daily_visit_stats_org_unit_id_day_idx" ON "daily_visit_stats"("org_unit_id", "day");

-- AddForeignKey
ALTER TABLE "daily_visit_stats" ADD CONSTRAINT "daily_visit_stats_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;


-- Nap so lieu gop cho moi check-in da co, cung cach tinh voi packages/db/src/daily-visit-stats.ts.
INSERT INTO "daily_visit_stats" ("id", "day", "org_unit_id", "user_id", "place_kind", "province_name", "visits",
  "flagged", "road_km", "road_visits", "gps_km", "gps_visits", "computed_at")
SELECT gen_random_uuid(), (c."captured_at" + interval '7 hours')::date, c."org_unit_id", c."user_id",
  c."place_kind", d."province_name",
  count(*)::int,
  (count(*) FILTER (WHERE coalesce(cardinality(c."flags"), 0) > 0))::int,
  coalesce(sum(c."road_distance_km"), 0),
  count(c."road_distance_km")::int,
  coalesce(sum(c."gps_distance_km") FILTER (WHERE c."road_distance_km" IS NULL), 0),
  (count(*) FILTER (WHERE c."road_distance_km" IS NULL AND c."gps_distance_km" > 0))::int,
  now()
FROM "check_ins" c
LEFT JOIN "dealers" d ON d."id" = c."dealer_id"
GROUP BY 2, 3, 4, 5, 6;
