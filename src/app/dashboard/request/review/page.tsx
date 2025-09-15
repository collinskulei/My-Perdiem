/**
 * @file This file defines the final review page for a per diem request.
 * It uses a Suspense boundary to handle asynchronous data loading from URL search parameters.
 * The main component calculates and displays a summary of the per diem costs and handles the final submission.
 */
'use client';

import { Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { useState, useMemo } from 'react';
import { Loader2, Car, Plane, Bed, DollarSign } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { SuccessDialog } from '@/components/success-dialog';
import { addPerDiemRequest, PerDiemRequestData } from '@/lib/firebase/firestore';

// Constants for per diem calculation.
const MILEAGE_RATE_KSH = 45;
const DAILY_ALLOWANCE = 5000;

/**
 * Renders the contents of the review page.
 * This component reads form data from URL search parameters, calculates the per diem summary,
 * and handles the final form submission.
 * @returns {JSX.Element} The rendered review page contents.
 */
function ReviewPageContents() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);

  /**
   * Memoized parsing of form data from URL search parameters.
   * This converts string values back to their appropriate types (Date, Number).
   */
  const formData = useMemo(() => {
    const data: { [key: string]: any } = {};
    searchParams.forEach((value, key) => {
      if (key === 'date') {
        data[key] = new Date(value);
      } else if (['mileage', 'airTicketCosts', 'accommodationCost', 'numberOfNights'].includes(key)) {
        data[key] = Number(value);
      } else {
        data[key] = value;
      }
    });
    return data;
  }, [searchParams]);

  /**
   * Memoized calculation of per diem costs.
   * This recalculates only when the form data changes.
   */
  const { totalPerdiem, mileageCost, airCost, accommodationCost, dailyAllowanceCost } = useMemo(() => {
    const mileageCalc = (formData.mileage || 0) * MILEAGE_RATE_KSH;
    const airCalc = formData.airTicketCosts || 0;
    const accommodationCalc = (formData.accommodationCost || 0) * (formData.numberOfNights || 1);
    const dailyAllowanceCalc = DAILY_ALLOWANCE * (formData.numberOfNights || 1);
    return {
      totalPerdiem: mileageCalc + airCalc + accommodationCalc + dailyAllowanceCalc,
      mileageCost: mileageCalc,
      airCost: airCalc,
      accommodationCost: accommodationCalc,
      dailyAllowanceCost: dailyAllowanceCalc,
    };
  }, [formData]);

  /**
   * Handles the final submission of the per diem request.
   * Simulates an API call and displays a success dialog upon completion.
   */
  const handleSubmit = async () => {
    setIsSubmitting(true);
    
    // Mocked employee data. In a real app, this would come from an auth context.
    const employeeId = '1';
    const employeeName = 'John Doe';

    const requestData: PerDiemRequestData = {
      employeeId,
      employeeName,
      eventName: formData.eventName,
      location: formData.venueCity,
      date: formData.date.toISOString().split('T')[0], // Format as YYYY-MM-DD
      totalPerdiem,
      status: 'Pending',
      checkInTimestamp: Date.now(),
    };
    
    try {
      await addPerDiemRequest(requestData);
      setIsSubmitting(false);
      setIsSuccess(true);
    } catch (error) {
      console.error("Error submitting request: ", error);
      setIsSubmitting(false);
      // Optionally show an error toast
    }
  };
  
  /**
   * Handles closing the success dialog and navigating back to the dashboard.
   */
  const handleDone = () => {
    setIsSuccess(false);
    router.push('/dashboard');
  };

  return (
    <>
      {/* Success dialog is displayed after a successful submission */}
      <SuccessDialog
        isOpen={isSuccess}
        onClose={handleDone}
        title="Request Submitted!"
        description="Your per diem request has been successfully submitted for approval."
      />
      <Card className="w-full max-w-2xl mx-auto">
        <CardHeader>
          <CardTitle className="text-2xl">Review Per Diem Request</CardTitle>
          <CardDescription>Please review the details below and submit your request.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Activity Details</CardTitle>
            </CardHeader>
            <CardContent className="grid grid-cols-2 gap-4 text-sm">
              <div className="font-medium">Activity Name:</div>
              <div>{formData.eventName}</div>
              <div className="font-medium">Activity Code:</div>
              <div>{formData.activityCode}</div>
              <div className="font-medium">Venue:</div>
              <div>{formData.venueName} ({formData.venueCity})</div>
              <div className="font-medium">Date:</div>
              <div>{formData.date ? new Date(formData.date).toLocaleDateString() : ''}</div>
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader>
              <CardTitle>Per Diem Summary</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-muted-foreground">
                  <Car />
                  <span>Mileage ({formData.mileage} km)</span>
                </div>
                <span className="font-medium">Ksh {mileageCost.toLocaleString()}</span>
              </div>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-muted-foreground">
                  <Plane />
                  <span>Air Ticket</span>
                </div>
                <span className="font-medium">Ksh {airCost.toLocaleString()}</span>
              </div>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-muted-foreground">
                  <Bed />
                  <span>Accommodation ({formData.numberOfNights} nights)</span>
                </div>
                <span className="font-medium">Ksh {accommodationCost.toLocaleString()}</span>
              </div>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-muted-foreground">
                  <DollarSign />
                  <span>Daily Allowance ({formData.numberOfNights} days)</span>
                </div>
                <span className="font-medium">Ksh {dailyAllowanceCost.toLocaleString()}</span>
              </div>
            </CardContent>
            <CardFooter className="flex items-center justify-between font-bold text-lg bg-muted/50 p-4 rounded-b-lg">
              <span>Total Per Diem</span>
              <span>Ksh {totalPerdiem.toLocaleString()}</span>
            </CardFooter>
          </Card>
        </CardContent>
        <CardFooter className="flex justify-end">
          <Button type="button" onClick={handleSubmit} disabled={isSubmitting}>
            {isSubmitting ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Submitting...
              </>
            ) : (
              "Submit Request"
            )}
          </Button>
        </CardFooter>
      </Card>
    </>
  );
}

/**
 * The main export for the review page.
 * It wraps the page content in a Suspense boundary to handle the asynchronous loading
 * of search parameters, preventing rendering errors on the server.
 * @returns {JSX.Element} The review page component.
 */
export default function ReviewPage() {
  return (
    <Suspense fallback={<div>Loading review...</div>}>
      <ReviewPageContents />
    </Suspense>
  );
}
