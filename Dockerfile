# Sử dụng hình ảnh Node.js chính thức
FROM node:18-alpine

# Thiết lập thư mục làm việc
WORKDIR /app

# Sao chép file package.json và package-lock.json (nếu có)
COPY package*.json ./

# Cài đặt các phụ thuộc
RUN npm install --production

# Sao chép toàn bộ mã nguồn vào container
COPY . .

RUN npm install -g @nestjs/cli

# Biên dịch mã TypeScript sang JavaScript
RUN npm run build

# Mở cổng ứng dụng
EXPOSE 8222

# Khởi chạy ứng dụng
CMD ["npm", "run", "start:prod"]
