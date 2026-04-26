import { NextRequest, NextResponse } from 'next/server'

const GRAPHQL_ENDPOINT = 'http://localhost:3009/api/graphql'

const CREATE_TEST_DRIVE = `
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

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()

    const { customerName, customerEmail, customerPhone, preferredDate, preferredTime, vehicleId, message } = body

    // Validate required fields
    if (!customerName || !customerEmail || !customerPhone || !preferredDate || !preferredTime) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      )
    }

    // Prepare data for GraphQL mutation
    const testDriveData: any = {
      customerName,
      customerEmail,
      customerPhone,
      preferredDate,
      preferredTime,
      status: 'pending'
    }

    // Add optional fields if provided
    if (vehicleId) {
      testDriveData.vehicle = { connect: { id: vehicleId } }
    }

    if (message) {
      testDriveData.notes = message
    }

    // Call GraphQL API
    const response = await fetch(GRAPHQL_ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        query: CREATE_TEST_DRIVE,
        variables: {
          data: testDriveData
        }
      })
    })

    const result = await response.json()

    if (result.errors) {
      console.error('GraphQL errors:', result.errors)
      return NextResponse.json(
        { error: 'Failed to create test drive appointment' },
        { status: 500 }
      )
    }

    return NextResponse.json(result.data.createTestDrive, { status: 201 })
  } catch (error) {
    console.error('Error creating test drive:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
