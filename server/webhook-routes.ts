import { Router, Request, Response } from "express";
import { whopClient } from "./whop";
import {
  updateWalletBalance,
  createTransaction,
  getTransactionsCollection,
} from "./mongodb";

const router = Router();

// Whop payment webhook
router.post("/webhook/payment", async (req: Request, res: Response) => {
  try {
    const webhookSecret = process.env.WHOP_WEBHOOK_SECRET;
    
    if (!webhookSecret) {
      console.error("WHOP_WEBHOOK_SECRET not configured");
      return res.status(500).json({ error: "Webhook not configured" });
    }
    
    // Get raw body for signature verification
    const rawBody = JSON.stringify(req.body);
    const headers = req.headers as Record<string, string>;
    
    // Verify webhook signature
    let webhookData;
    try {
      webhookData = whopClient.webhooks.unwrap(rawBody, { headers });
    } catch (error) {
      console.error("Webhook signature verification failed:", error);
      return res.status(401).json({ error: "Invalid webhook signature" });
    }
    
    console.log("Received webhook:", webhookData.type);
    
    if (webhookData.type === "payment.succeeded") {
      const payment = webhookData.data;
      
      // Extract metadata
      const metadata = payment.checkout_configuration?.metadata || {};
      
      if (metadata.type === "deposit") {
        const userId = metadata.user_id;
        const amountCents = parseInt(metadata.amount_cents) || 0;
        const checkoutConfigId = payment.checkout_configuration?.id;
        
        if (!userId || !amountCents) {
          console.error("[Webhook] Invalid deposit metadata:", metadata);
          return res.status(400).json({ error: "Invalid metadata" });
        }
        
        const transactions = getTransactionsCollection();
        
        // Check if this payment was already processed (prevent double-crediting)
        const existingCompleted = await transactions.findOne({
          type: "deposit",
          status: "completed",
          "metadata.paymentId": payment.id,
        });
        
        if (existingCompleted) {
          console.log(`[Webhook] Payment ${payment.id} already processed, skipping`);
          return res.status(200).json({ received: true, already_processed: true });
        }
        
        // Update wallet balance
        const wallet = await updateWalletBalance(userId, amountCents, "add");
        
        if (!wallet) {
          console.error("[Webhook] Failed to update wallet for user:", userId);
          return res.status(500).json({ error: "Failed to update wallet" });
        }
        
        // Update pending transaction to completed
        const updateResult = await transactions.updateOne(
          { 
            odellId: userId, 
            type: "deposit", 
            status: "pending",
            "metadata.checkoutConfigId": checkoutConfigId 
          },
          { 
            $set: { 
              status: "completed",
              "metadata.paymentId": payment.id,
              amount: amountCents,
            } 
          }
        );
        
        // If no pending transaction was found, create a new completed one
        if (updateResult.matchedCount === 0) {
          await createTransaction({
            odellId: userId,
            type: "deposit",
            amount: amountCents,
            currency: "usd",
            status: "completed",
            metadata: {
              paymentId: payment.id,
              checkoutConfigId: checkoutConfigId,
              description: `Deposit $${(amountCents / 100).toFixed(2)}`,
              source: "webhook",
            },
          });
        }
        
        console.log(`[Webhook] Deposit processed: ${userId} +$${(amountCents / 100).toFixed(2)} (payment: ${payment.id})`);
      }
    }
    
    // Always respond 200 quickly
    res.status(200).json({ received: true });
  } catch (error) {
    console.error("Webhook error:", error);
    res.status(500).json({ error: "Webhook processing failed" });
  }
});

export default router;
