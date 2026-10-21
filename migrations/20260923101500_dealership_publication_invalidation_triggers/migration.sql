CREATE OR REPLACE FUNCTION invalidate_publication_for_vehicle_change()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF ROW(
    OLD."rooftop", OLD."vin", OLD."stockNumber", OLD."year", OLD."make", OLD."model", OLD."trim",
    OLD."exteriorColor", OLD."interiorColor", OLD."mileage", OLD."condition", OLD."priceCents",
    OLD."listPriceCents", OLD."description", OLD."features", OLD."status"
  ) IS NOT DISTINCT FROM ROW(
    NEW."rooftop", NEW."vin", NEW."stockNumber", NEW."year", NEW."make", NEW."model", NEW."trim",
    NEW."exteriorColor", NEW."interiorColor", NEW."mileage", NEW."condition", NEW."priceCents",
    NEW."listPriceCents", NEW."description", NEW."features", NEW."status"
  ) THEN
    RETURN NEW;
  END IF;

  UPDATE "InventoryStock"
  SET "approvedRevisionHash" = '',
      "merchandisingStatus" = 'draft',
      "feedStatus" = 'not-published',
      "updatedAt" = CURRENT_TIMESTAMP
  WHERE "vehicle" = NEW."id";
  RETURN NEW;
END;
$$;

CREATE TRIGGER "Vehicle_invalidate_publication_after_merchandising_change"
AFTER UPDATE OF "rooftop", "vin", "stockNumber", "year", "make", "model", "trim",
  "exteriorColor", "interiorColor", "mileage", "condition", "priceCents", "listPriceCents",
  "description", "features", "status" ON "Vehicle"
FOR EACH ROW EXECUTE FUNCTION invalidate_publication_for_vehicle_change();

CREATE OR REPLACE FUNCTION invalidate_publication_for_vehicle_image_change()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  affected_vehicle_ids TEXT[];
BEGIN
  IF TG_OP = 'UPDATE' THEN
    IF ROW(
      OLD."vehicle", OLD."rooftop", OLD."imagePath", OLD."image_id", OLD."image_extension",
      OLD."caption", OLD."category", OLD."isPrimary", OLD."sortOrder"
    ) IS NOT DISTINCT FROM ROW(
      NEW."vehicle", NEW."rooftop", NEW."imagePath", NEW."image_id", NEW."image_extension",
      NEW."caption", NEW."category", NEW."isPrimary", NEW."sortOrder"
    ) THEN
      RETURN NEW;
    END IF;
  END IF;

  IF TG_OP = 'INSERT' THEN
    affected_vehicle_ids := ARRAY[NEW."vehicle"];
  ELSIF TG_OP = 'DELETE' THEN
    affected_vehicle_ids := ARRAY[OLD."vehicle"];
  ELSE
    affected_vehicle_ids := ARRAY[OLD."vehicle", NEW."vehicle"];
  END IF;

  UPDATE "InventoryStock"
  SET "approvedRevisionHash" = '',
      "merchandisingStatus" = 'draft',
      "feedStatus" = 'not-published',
      "updatedAt" = CURRENT_TIMESTAMP
  WHERE "vehicle" = ANY(affected_vehicle_ids);

  IF TG_OP = 'DELETE' THEN RETURN OLD; END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER "VehicleImage_invalidate_publication_after_merchandising_change"
AFTER INSERT OR UPDATE OF "vehicle", "rooftop", "imagePath", "image_id", "image_extension",
  "caption", "category", "isPrimary", "sortOrder" OR DELETE ON "VehicleImage"
FOR EACH ROW EXECUTE FUNCTION invalidate_publication_for_vehicle_image_change();

CREATE OR REPLACE FUNCTION invalidate_publication_for_inventory_stock_change()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF ROW(OLD."rooftop", OLD."vehicle", OLD."stockNumber") IS NOT DISTINCT FROM
     ROW(NEW."rooftop", NEW."vehicle", NEW."stockNumber") THEN
    RETURN NEW;
  END IF;

  UPDATE "InventoryStock"
  SET "approvedRevisionHash" = '',
      "merchandisingStatus" = 'draft',
      "feedStatus" = 'not-published',
      "updatedAt" = CURRENT_TIMESTAMP
  WHERE "id" IN (OLD."id", NEW."id")
     OR "vehicle" = OLD."vehicle"
     OR "vehicle" = NEW."vehicle";
  RETURN NEW;
END;
$$;

CREATE TRIGGER "InventoryStock_invalidate_publication_after_identity_change"
AFTER UPDATE OF "rooftop", "vehicle", "stockNumber" ON "InventoryStock"
FOR EACH ROW EXECUTE FUNCTION invalidate_publication_for_inventory_stock_change();
