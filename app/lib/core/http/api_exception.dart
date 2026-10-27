/// 后端业务/网络统一异常
class ApiException implements Exception {
  final String message;
  final int? status;
  ApiException(this.message, {this.status});

  @override
  String toString() => message;
}
