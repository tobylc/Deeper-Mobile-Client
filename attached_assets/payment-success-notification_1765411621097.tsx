import { useState, useEffect } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';
import { CheckCircle, Crown, Sparkles } from 'lucide-react';
import { useQueryClient } from '@tanstack/react-query';

export function PaymentSuccessNotification() {
  const { user, isLoading: authLoading } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [hasCheckedPayment, setHasCheckedPayment] = useState(false);

  useEffect(() => {
    // Wait for authentication to complete before checking payment
    if (authLoading || !user || hasCheckedPayment) return;

    const checkPaymentSuccess = async () => {
      try {
        // Check if user just upgraded from URL parameters or localStorage
        const urlParams = new URLSearchParams(window.location.search);
        const fromCheckout = urlParams.get('from') === 'checkout';
        const hasDiscountPayment = urlParams.get('payment_success') === 'true' && urlParams.get('discount') === 'true';
        const paymentSuccess = localStorage.getItem('paymentSuccess');
        
        if (fromCheckout || paymentSuccess || hasDiscountPayment) {
          console.log('[PAYMENT_SUCCESS] Checking for successful payment upgrade');
          console.log('[PAYMENT_SUCCESS] From checkout:', fromCheckout);
          console.log('[PAYMENT_SUCCESS] Has discount payment:', hasDiscountPayment);
          
          // Clean up markers
          localStorage.removeItem('paymentSuccess');
          if (fromCheckout || hasDiscountPayment) {
            window.history.replaceState({}, '', window.location.pathname);
          }
          
          // For discount payments, more aggressive checking
          const maxAttempts = hasDiscountPayment ? 5 : 2;
          let upgraded = false;
          
          for (let attempt = 1; attempt <= maxAttempts; attempt++) {
            console.log(`[PAYMENT_SUCCESS] Attempt ${attempt}/${maxAttempts} - Triggering payment status check`);
            
            try {
              const checkResponse = await fetch('/api/subscription/check-payment-status', {
                method: 'POST',
                credentials: 'include'
              });
              
              if (checkResponse.ok) {
                const checkResult = await checkResponse.json();
                console.log(`[PAYMENT_SUCCESS] Check result:`, checkResult);
                console.log(`[PAYMENT_SUCCESS] Check result upgraded:`, checkResult.upgraded);
                console.log(`[PAYMENT_SUCCESS] Check result tier:`, checkResult.tier);
                console.log(`[PAYMENT_SUCCESS] Check result message:`, checkResult.message);
                
                if (checkResult.upgraded) {
                  upgraded = true;
                  console.log(`[PAYMENT_SUCCESS] ✅ Upgrade detected on attempt ${attempt}`);
                  
                  // Wait a moment to ensure backend has fully processed the upgrade
                  await new Promise(resolve => setTimeout(resolve, 500));
                  
                  // Smoothly refresh the UI by invalidating cached data
                  console.log(`[PAYMENT_SUCCESS] Refreshing UI data after successful upgrade`);
                  await queryClient.invalidateQueries();
                  
                  // Force refetch of specific critical queries to ensure immediate UI updates
                  await queryClient.refetchQueries({ queryKey: ['/api/trial-status'] });
                  await queryClient.refetchQueries({ queryKey: ['/api/auth/user'] });
                  
                  break;
                }
              } else {
                console.error(`[PAYMENT_SUCCESS] Check response not ok:`, checkResponse.status, checkResponse.statusText);
                const errorText = await checkResponse.text();
                console.error(`[PAYMENT_SUCCESS] Error response:`, errorText);
              }
            } catch (error) {
              console.error(`[PAYMENT_SUCCESS] Check attempt ${attempt} failed:`, error);
            }
            
            // Wait before next attempt (longer for later attempts)
            if (attempt < maxAttempts && !upgraded) {
              await new Promise(resolve => setTimeout(resolve, attempt * 1500));
            }
          }
          
          // Check if user has Advanced plan
          const response = await fetch('/api/trial-status', {
            method: 'GET',
            credentials: 'include'
          });
          
          if (response.ok) {
            const trialStatus = await response.json();
            console.log(`[PAYMENT_SUCCESS] Final trial status check:`, trialStatus);
            
            // Final cache refresh to ensure UI consistency
            console.log(`[PAYMENT_SUCCESS] Final UI refresh to ensure consistency`);
            await queryClient.invalidateQueries({ queryKey: ['/api/trial-status'] });
            await queryClient.invalidateQueries({ queryKey: ['/api/auth/user'] });
            
            if (trialStatus.subscriptionTier === 'advanced') {
              // Show success notification with application's standard styling
              toast({
                title: "🎉 Welcome to Advanced!",
                description: "Your payment was successful. You now have access to 3 connections and all premium features!",
                duration: 8000
              });
              
              // Also show a celebratory overlay briefly
              setTimeout(() => {
                toast({
                  title: "✨ Advanced Plan Activated",
                  description: "Start inviting up to 3 people for deeper conversations!",
                  duration: 6000
                });
              }, 2000);
            } else {
              console.log(`[PAYMENT_SUCCESS] User tier is not advanced: ${trialStatus.subscriptionTier}`);
              console.log(`[PAYMENT_SUCCESS] Subscription status: ${trialStatus.subscriptionStatus}`);
            }
          }
        }
      } catch (error) {
        console.error('Payment success check failed:', error);
      } finally {
        setHasCheckedPayment(true);
      }
    };

    // Check after a delay to allow authentication and backend processing to complete
    const timer = setTimeout(checkPaymentSuccess, 2000);
    return () => clearTimeout(timer);
  }, [user, authLoading, hasCheckedPayment, toast]);

  return null; // This component doesn't render anything visible
}