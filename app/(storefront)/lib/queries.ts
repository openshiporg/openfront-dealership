export const GET_VEHICLES = `
  query GetVehicles(
    $where: VehicleWhereInput
    $orderBy: [VehicleOrderByInput!]
    $take: Int
    $skip: Int
  ) {
    vehicles(where: $where, orderBy: $orderBy, take: $take, skip: $skip) {
      id
      vin
      stockNumber
      year
      make
      model
      trim
      color
      mileage
      price
      status
      condition
      description
      features
      images {
        id
        image {
          url
        }
        isPrimary
        sortOrder
      }
    }
  }
`

export const GET_VEHICLE_BY_ID = `
  query GetVehicle($id: ID!) {
    vehicle(where: { id: $id }) {
      id
      vin
      stockNumber
      year
      make
      model
      trim
      color
      mileage
      price
      status
      condition
      features
      description
      images {
        id
        image {
          url
        }
        isPrimary
        sortOrder
      }
    }
  }
`

export const GET_VEHICLES_COUNT = `
  query GetVehiclesCount($where: VehicleWhereInput) {
    vehiclesCount(where: $where)
  }
`

export const GET_MAKES = `
  query GetMakes {
    makes(orderBy: { name: asc }) {
      id
      name
      vehiclesCount
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

export const CREATE_LEAD = `
  mutation CreateLead($data: LeadCreateInput!) {
    createLead(data: $data) {
      id
      firstName
      lastName
      email
      phone
    }
  }
`

export const CREATE_TEST_DRIVE = `
  mutation CreateTestDrive($data: TestDriveCreateInput!) {
    createTestDrive(data: $data) {
      id
      customerName
      customerEmail
      customerPhone
      preferredDate
      preferredTime
    }
  }
`

export const CREATE_TRADE_IN = `
  mutation CreateTradeIn($data: TradeInCreateInput!) {
    createTradeIn(data: $data) {
      id
      customerName
      customerEmail
      customerPhone
      vehicleYear
      vehicleMake
      vehicleModel
      vehicleMileage
      vehicleCondition
      estimatedValue
    }
  }
`

export const CREATE_FINANCING = `
  mutation CreateFinancing($data: FinancingCreateInput!) {
    createFinancing(data: $data) {
      id
      customerName
      customerEmail
      customerPhone
      requestedAmount
      status
    }
  }
`

export const CREATE_SERVICE_APPOINTMENT = `
  mutation CreateServiceAppointment($data: ServiceAppointmentCreateInput!) {
    createServiceAppointment(data: $data) {
      id
      customerName
      customerEmail
      customerPhone
      appointmentDate
      appointmentTime
      serviceType
      status
    }
  }
`

export const GET_DEALERSHIP_INFO = `
  query GetDealershipInfo {
    dealershipInfos(take: 1) {
      id
      name
      address
      city
      state
      zipCode
      phone
      email
      website
      hoursMonFri
      hoursSat
      hoursSun
      aboutUs
      missionStatement
    }
  }
`
