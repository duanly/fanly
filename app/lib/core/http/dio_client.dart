import 'package:dio/dio.dart';
import '../config/app_config.dart';
import '../storage/token_store.dart';
import 'api_exception.dart';

/// 全局 dio 单例。
/// 复刻 H5（h5/src/api/index.js）行为：
/// - 请求自动带 Bearer token
/// - 后端统一信封 { code, msg, data }，code==0 时解包成 data
/// - 401 清 token 并触发全局跳登录（由 main 注入 onUnauthorized）
class DioClient {
  DioClient._internal() {
    _dio = Dio(BaseOptions(
      baseUrl: AppConfig.apiBase,
      connectTimeout: const Duration(seconds: 15),
      receiveTimeout: const Duration(seconds: 15),
    ));
    _dio.interceptors.add(InterceptorsWrapper(
      onRequest: (options, handler) async {
        final t = await TokenStore.instance.token;
        if (t != null && t.isNotEmpty) {
          options.headers['Authorization'] = 'Bearer $t';
        }
        handler.next(options);
      },
      onResponse: (response, handler) {
        final body = response.data;
        if (body is Map && body['code'] == 0) {
          response.data = body['data'];
          handler.next(response);
          return;
        }
        final msg = (body is Map ? body['msg'] : null)?.toString() ?? '请求失败';
        handler.reject(
          DioException(
            requestOptions: response.requestOptions,
            response: response,
            type: DioExceptionType.badResponse,
            error: ApiException(msg),
          ),
          true,
        );
      },
      onError: (e, handler) {
        final status = e.response?.statusCode;
        final body = e.response?.data;
        final msg = (body is Map ? body['msg'] : null)?.toString() ??
            e.message ??
            '网络错误';
        if (status == 401) {
          TokenStore.instance.clearToken();
          onUnauthorized?.call();
        }
        handler.next(DioException(
          requestOptions: e.requestOptions,
          response: e.response,
          type: e.type,
          error: ApiException(msg.toString(), status: status),
        ));
      },
    ));
  }

  static final DioClient instance = DioClient._internal();
  late final Dio _dio;
  Dio get dio => _dio;

  /// 401 全局回调（由 main 注入：清登录态 + 跳 /login）
  void Function()? onUnauthorized;

  Future<dynamic> get(String path, {Map<String, dynamic>? params}) =>
      _dio.get(path, queryParameters: params).then((r) => r.data);

  Future<dynamic> post(String path, {Object? data}) =>
      _dio.post(path, data: data).then((r) => r.data);

  Future<dynamic> delete(String path, {Object? data}) =>
      _dio.delete(path, data: data).then((r) => r.data);

  /// 上传文件（字段名 file，与后端一致）
  Future<dynamic> uploadFile(
    String path,
    String filePath, {
    String filename = 'file.jpg',
  }) async {
    final form = FormData.fromMap({
      'file': await MultipartFile.fromFile(filePath, filename: filename),
    });
    final r = await _dio.post(path, data: form);
    return r.data;
  }
}
