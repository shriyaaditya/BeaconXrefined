
import { google } from 'googleapis';
import { NextResponse } from 'next/server';

export async function GET() {
  try {
    // 1. Validate environment variables
    const requiredEnvVars = [
      'GOOGLE_CLIENT_EMAIL',
      'GOOGLE_PRIVATE_KEY',
      'SPREADSHEET_ID'
    ];
    
    const missingVars = requiredEnvVars.filter(varName => !process.env[varName]);
    if (missingVars.length > 0) {
      throw new Error(`Missing environment variables: ${missingVars.join(', ')}`);
    }

    // 2. Initialize auth with debugging
    console.log('Initializing Google Sheets auth...');
    const auth = new google.auth.JWT({
      email: process.env.GOOGLE_CLIENT_EMAIL,
      key: (process.env.GOOGLE_PRIVATE_KEY || "").replace(/\\n/g, '\n'),
      scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly'],
    });

    // 3. Test authentication
    console.log('Authenticating...');
    await auth.authorize();
    console.log('Authentication successful');

    // 4. Access sheets
    const sheets = google.sheets({ version: 'v4', auth });
    console.log(`Fetching data from spreadsheet ${process.env.SPREADSHEET_ID}`);
    
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId: process.env.SPREADSHEET_ID,
      range: 'Sheet1!A:F',
    });

    if (!response.data.values) {
      console.warn('No data found in sheet');
      return NextResponse.json(
        { values: [] },
        { status: 200 }
      );
    }

    return NextResponse.json({
      values: response.data.values,
    });

  } catch (error) {
    console.error('FULL ERROR DETAILS:', error);
    
    // Enhanced error parsing
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    const errorDetails = error instanceof Error ? error.stack : JSON.stringify(error);
    
    return NextResponse.json(
      {
        error: 'Failed to fetch sheet data',
        message: errorMessage,
        // Only include details in development
        ...(process.env.NODE_ENV === 'development' && { details: errorDetails }),
      },
      { status: 500 }
    );
  }
}