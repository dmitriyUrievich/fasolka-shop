import { Router, Request, Response } from 'express';
import { YooCheckout, ICreatePayment } from '@a2seven/yoo-checkout';
import dotenv from 'dotenv';
import { v4 as uuidv4 } from 'uuid';
dotenv.config();

const router = Router();

const YOUKASSA_SECRET_KEY = process.env.YOUKASSA_KEY || '';
const YOUKASSA_SHOP_ID = process.env.YOUKASSA_ID || '';

if (!YOUKASSA_SECRET_KEY || !YOUKASSA_SHOP_ID) {
  console.error('Ошибка: Не заданы учетные данные YooKassa!');
}
const database:any = {
  
}
const YooKassa = new YooCheckout({
  shopId: YOUKASSA_SHOP_ID,
  secretKey: YOUKASSA_SECRET_KEY,
});

router.post('/payment', async (req: Request, res: Response) => {

  const createPayload: ICreatePayment = {
      amount: {
        value: req.body.value, 
        currency: 'RUB',
      },
      payment_method_data: {
        type: 'bank_card',
      },
      capture:true,
      confirmation: {
        type: 'redirect',
        return_url: 'https://fasol-nvrsk.ru/',
      },
      description: req.body.oederId,
      metadata:{
        oederId:req.body.oederId,
      },
    };

  try {
    const payment = await YooKassa.createPayment(createPayload, uuidv4());

    res.json({payment});
    console.log(payment)

  } catch (error:any) {
    console.error('Ошибка при создании платежа:', error);
    res.status(400).json({error: error.data });
  }
}); 

router.post('/payment/notifications', async (req: Request, res: Response) => {
    console.log(req.body)
    database[req.body.id]=req.body
    res.json('OK/S')
})

export default router;