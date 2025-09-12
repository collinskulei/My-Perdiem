
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

const MILEAGE_RATE_KSH = 45;
const DAILY_ALLOWANCE = 5000;

function ReviewPageContents() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);

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

  const handleSubmit = async () => {
    setIsSubmitting(true);
    const submittedData = {
      ...formData,
      location: formData.venueCity,
      checkInTimestamp: Date.now(),
      totalPerdiem,
    };
    
    console.log("Submitting:", submittedData);

    // Simulate API call
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    setIsSubmitting(false);
    setIsSuccess(true);
  };
  
  const handleDone = () => {
    setIsSuccess(false);
    router.push('/dashboard');
  };

  return (
    <>
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

export default function ReviewPage() {
  return (
    <Suspense fallback={<div>Loading review...</div>}>
      <ReviewPageContents />
    </Suspense>
  );
}

    