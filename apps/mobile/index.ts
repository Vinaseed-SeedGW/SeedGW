import { registerRootComponent } from 'expo';
// Đăng ký task ghi hành trình trước khi render, để hệ điều hành gọi lại được khi app chạy nền.
import './src/sync/background-tracking';
import { App } from './App';

registerRootComponent(App);
