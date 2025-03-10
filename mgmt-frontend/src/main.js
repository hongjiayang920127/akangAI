import { createApp } from 'vue'
import { createPinia } from 'pinia'
import router from './router'
import App from './App.vue'
import './assets/main.css'

// 导入axios实例（确保axios拦截器在应用启动前就已设置）
import './utils/axios'

const app = createApp(App)

app.use(createPinia())
app.use(router)
app.mount('#app')