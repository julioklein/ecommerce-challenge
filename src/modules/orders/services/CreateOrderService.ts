import { inject, injectable } from 'tsyringe';

import AppError from '@shared/errors/AppError';

import IProductsRepository from '@modules/products/repositories/IProductsRepository';
import ICustomersRepository from '@modules/customers/repositories/ICustomersRepository';
import Order from '../infra/typeorm/entities/Order';
import IOrdersRepository from '../repositories/IOrdersRepository';

interface IProduct {
  id: string;
  quantity: number;
}

interface IRequest {
  customer_id: string;
  products: IProduct[];
}

@injectable()
class CreateOrderService {
  constructor(
    @inject('OrdersRepository')
    private ordersRepository: IOrdersRepository,
    @inject('ProductsRepository')
    private productsRepository: IProductsRepository,
    @inject('CustomersRepository')
    private customersRepository: ICustomersRepository,
  ) {}

  public async execute({ customer_id, products }: IRequest): Promise<Order> {
    const customer = await this.customersRepository.findById(customer_id);

    if (!customer) {
      throw new AppError('User does not exist.');
    }

    const validProducts = await this.productsRepository.findAllById(products);

    if (!validProducts.length) {
      throw new AppError('Invalid products');
    }

    const productsInStock = validProducts.map(product => product.id);

    const invalidProducts = products.filter(
      product => !productsInStock.includes(product.id),
    );

    if (invalidProducts.length) {
      throw new AppError(`Invalid product: ${invalidProducts[0].id}`);
    }

    const productsOutOfStock = products.filter(
      product =>
        validProducts.filter(vProduct => vProduct.id === product.id)[0]
          .quantity < product.quantity,
    );

    if (productsOutOfStock.length) {
      throw new AppError(`Product out of stock: ${productsOutOfStock[0].id}`);
    }

    const productsFormattedForOrder = products.map(product => ({
      product_id: product.id,
      quantity: product.quantity,
      price: validProducts.filter(vProduct => vProduct.id === product.id)[0]
        .price,
    }));

    const orderCreated = await this.ordersRepository.create({
      customer,
      products: productsFormattedForOrder,
    });

    const updateProductsQuantity = products.map(product => ({
      id: product.id,
      quantity:
        validProducts.filter(vProduct => vProduct.id === product.id)[0]
          .quantity - product.quantity,
    }));

    await this.productsRepository.updateQuantity(updateProductsQuantity);

    return orderCreated;
  }
}

export default CreateOrderService;
