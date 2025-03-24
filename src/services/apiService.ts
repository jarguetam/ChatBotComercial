import axios from "axios";
import https from "https";

// Configuración global de Axios
const apiClient = axios.create({
  baseURL: process.env.API_URL ?? "https://localhost:5001",
  httpsAgent: new https.Agent({
    rejectUnauthorized: false,
  }),
  timeout: 10000,
});
// Configuración global de Axios
const apiClientReports = axios.create({
  baseURL: process.env.API_REPORT_URL ?? "https://localhost:5001",
  httpsAgent: new https.Agent({
    rejectUnauthorized: false,
  }),
  timeout: 10000,
});

// Clase de servicio API
export class ApiService {
  // Validar vendedor por número de teléfono
  static async validateSeller(phone: string) {
    try {
      const response = await apiClient.post(
        `/api/DataSellers/ValidateSeller?phone=${phone}`
      );
      return response.status === 200 ? response.data : null;
    } catch (error) {
      console.error("Error validando vendedor:", error);
      return null;
    }
  }

  // Obtener top clientes
  static async getTopCustomerBySeller(sellerCode: string) {
    try {
      console.log("Consultando top clientes para vendedor:", sellerCode);
      const response = await apiClient.post(
        `/api/DataSellers/TopCustomerBySeller?codigo=${sellerCode}`
      );
      console.log(
        "Respuesta de TopCustomerBySeller:",
        JSON.stringify(response.data)
      );
      // Devolvemos la respuesta completa para poder acceder a la estructura anidada
      return response.status === 200 ? response.data : null;
    } catch (error) {
      console.error("Error obteniendo top clientes:", error);
      return null;
    }
  }

  // Obtener top productos
  static async getTopProductBySeller(sellerCode: string) {
    try {
      console.log("Consultando top productos para vendedor:", sellerCode);
      const response = await apiClient.post(
        `/api/DataSellers/TopProductBySeller?codigo=${sellerCode}`
      );
      console.log(
        "Respuesta de TopProductBySeller:",
        JSON.stringify(response.data)
      );
      // Devolvemos la respuesta completa para poder acceder a la estructura anidada
      return response.status === 200 ? response.data : null;
    } catch (error) {
      console.error("Error obteniendo top productos:", error);
      return null;
    }
  }
  // Obtener meta mensual del vendedor
  static async getSalesDayBySeller(sellerCode: string) {
    try {
      const response = await apiClient.post(
        `/api/DataSellers/SalesDayBySeller?codigo=${sellerCode}`
      );
      return response.status === 200 ? response.data : null;
    } catch (error) {
      console.error("Error obteniendo ventas diarias:", error);
      return null;
    }
  }

  // Obtener ventas de los últimos 6 meses
  static async getSalesSixMonthBySeller(sellerCode: string) {
    try {
      const response = await apiClient.post(
        `/api/DataSellers/SalesSixMonthBySeller?codigo=${sellerCode}`
      );
      return response.status === 200 ? response.data : null;
    } catch (error) {
      console.error("Error obteniendo ventas de 6 meses:", error);
      return null;
    }
  }

  // Consultar inventario de productos
  // Consultar inventario de productos en tránsito
  static async getTransitProduct(empresa: string) {
    try {
      console.log(
        "Consultando inventario en tránsito para la empresa:",
        empresa
      );
      const response = await apiClient.get(
        `/api/DataSellers/GetTransitProduct?codigo=${empresa}`
      );
      console.log(
        "Respuesta de GetTransitProduct:",
        JSON.stringify(response.data)
      );
      // Devolvemos la respuesta completa para poder acceder a la estructura anidada
      return response.status === 200 ? response.data : null;
    } catch (error) {
      console.error("Error consultando inventario:", error);
      return null;
    }
  }

  // Consultar limites de credito disponibles
  static async getCreditLimit(sellerCode: string, empresa: string) {
    try {
      console.log("Consultando límites de crédito para la empresa:", empresa);
      // Determinar la URL según la empresa
      let endpoint = "";
      if (empresa.toLowerCase() === "cadelga") {
        endpoint = `LimiteCreditoCad/${sellerCode}`;
      } else if (empresa.toLowerCase() === "fertica") {
        endpoint = `LimiteCreditoFer/${sellerCode}`;
      } else {
        throw new Error("Empresa no válida. Debe ser 'Cadelga' o 'Fertica'");
      }
      
      // Realizar la solicitud a la API
      const response = await apiClientReports.get(endpoint);
      
      // Verificar la respuesta y retornar los datos
      if (response.status === 200 && response.data) {
        // La respuesta contiene el documento en base64
        const responseData = response.data;
        
        // Verificar que la respuesta tenga la estructura esperada
        if (
          responseData.success && 
          responseData.fileName && 
          responseData.contentType && 
          responseData.base64Content
        ) {
          return responseData;
        }
      }
      
      return null;
    } catch (error) {
      console.error(`Error consultando límites de crédito para ${empresa}:`, error);
      return null;
    }
  }


}
