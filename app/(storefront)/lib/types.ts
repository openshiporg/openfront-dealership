export interface Vehicle {
  id: string
  vin: string
  stockNumber: string
  year: number
  make: string
  model: string
  trim: string
  color: string
  mileage: number
  price: number
  status: string
  condition: string
  features?: any
  description?: string
  images?: VehicleImage[]
  imagesCount?: number
}

export interface VehicleImage {
  id: string
  image: {
    url: string
  }
  isPrimary: boolean
  sortOrder: number
}

export interface Make {
  id: string
  name: string
  vehiclesCount?: number
}

export interface Model {
  id: string
  name: string
  make: {
    id: string
    name: string
  }
}

export interface VehicleFilters {
  make?: string
  model?: string
  yearMin?: number
  yearMax?: number
  priceMin?: number
  priceMax?: number
  mileageMax?: number
  condition?: string
  bodyType?: string
  certified?: boolean
}

export interface DealershipInfo {
  id: string
  name: string
  address: string
  city: string
  state: string
  zipCode: string
  phone: string
  email: string
  website: string
  hoursMonFri: string
  hoursSat: string
  hoursSun: string
  aboutUs: string
  missionStatement: string
}

export interface LeadFormData {
  firstName: string
  lastName: string
  email: string
  phone: string
  message?: string
  vehicleId?: string
  source?: string
}

export interface TestDriveFormData {
  customerName: string
  customerEmail: string
  customerPhone: string
  preferredDate: string
  preferredTime: string
  vehicleId?: string
  message?: string
}

export interface TradeInFormData {
  customerName: string
  customerEmail: string
  customerPhone: string
  vehicleYear: number
  vehicleMake: string
  vehicleModel: string
  vehicleMileage: number
  vehicleCondition: string
  vehicleVin?: string
  comments?: string
}

export interface FinancingFormData {
  customerName: string
  customerEmail: string
  customerPhone: string
  requestedAmount: number
  employmentStatus: string
  annualIncome: number
  creditScore?: string
  downPayment?: number
  vehicleId?: string
}

export interface ServiceAppointmentFormData {
  customerName: string
  customerEmail: string
  customerPhone: string
  appointmentDate: string
  appointmentTime: string
  serviceType: string
  vehicleYear?: number
  vehicleMake?: string
  vehicleModel?: string
  vehicleVin?: string
  description?: string
}
