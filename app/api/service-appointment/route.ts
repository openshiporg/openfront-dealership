import { NextRequest, NextResponse } from 'next/server'

const GRAPHQL_ENDPOINT = 'http://localhost:3009/api/graphql'

const CREATE_SERVICE_APPOINTMENT = `
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

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()

    const {
      customerName,
      customerEmail,
      customerPhone,
      appointmentDate,
      appointmentTime,
      serviceType,
      vehicleYear,
      vehicleMake,
      vehicleModel,
      vehicleVin,
      description
    } = body

    // Validate required fields
    if (!customerName || !customerEmail || !customerPhone || !appointmentDate || !appointmentTime || !serviceType) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      )
    }

    // Prepare data for GraphQL mutation
    const appointmentData: any = {
      customerName,
      customerEmail,
      customerPhone,
      appointmentDate,
      appointmentTime,
      serviceType,
      status: 'pending'
    }

    // Add optional vehicle fields if provided
    if (vehicleYear) {
      appointmentData.vehicleYear = vehicleYear
    }

    if (vehicleMake) {
      appointmentData.vehicleMake = vehicleMake
    }

    if (vehicleModel) {
      appointmentData.vehicleModel = vehicleModel
    }

    if (vehicleVin) {
      appointmentData.vehicleVin = vehicleVin
    }

    if (description) {
      appointmentData.description = description
    }

    // Call GraphQL API
    const response = await fetch(GRAPHQL_ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        query: CREATE_SERVICE_APPOINTMENT,
        variables: {
          data: appointmentData
        }
      })
    })

    const result = await response.json()

    if (result.errors) {
      console.error('GraphQL errors:', result.errors)
      return NextResponse.json(
        { error: 'Failed to create service appointment' },
        { status: 500 }
      )
    }

    return NextResponse.json(result.data.createServiceAppointment, { status: 201 })
  } catch (error) {
    console.error('Error creating service appointment:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
