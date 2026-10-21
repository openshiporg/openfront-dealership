export const GET_VEHICLES = `
  query GetVehicles(
    $where: JSON
    $orderBy: JSON
    $take: Int
    $skip: Int
  ) {
    publicInventoryVehicles(where: $where, orderBy: $orderBy, take: $take, skip: $skip) {
      totalCount
      items {
        id
        vin
        stockNumber
        year
        make
        model
        trim
        color: exteriorColor
        mileage
        price
        status
        condition
        description
        features
        images {
          id
          imagePath
          image { url }
          isPrimary
          sortOrder
        }
      }
    }
  }
`

export const GET_VEHICLE_BY_ID = `
  query GetVehicle($id: ID!) {
    publicInventoryVehicle(id: $id) {
      id
      vin
      stockNumber
      year
      make
      model
      trim
      color: exteriorColor
      mileage
      price
      status
      condition
      features
      description
      images {
        id
        imagePath
        image { url }
        isPrimary
        sortOrder
      }
    }
  }
`

export const GET_VEHICLES_COUNT = `
  query GetVehiclesCount($where: JSON) {
    publicInventoryCount(where: $where)
  }
`

export const GET_MAKES = `
  query GetMakes {
    makes(orderBy: { name: asc }) {
      id
      name
      vehiclesCount: modelsCount
    }
  }
`

export const GET_MODELS = `
  query GetModels($makeId: ID) {
    models(where: { make: { id: { equals: $makeId } } }, orderBy: { name: asc }) {
      id
      name
      make {
        id
        name
      }
    }
  }
`
